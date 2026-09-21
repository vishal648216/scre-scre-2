import { useState } from "react";
import { X, LogIn, Loader2, User, Shield, Eye, EyeOff, ShieldAlert, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useTranslation } from "react-i18next";

const sanitizeAuthErrorMessage = (message?: string) => {
  const raw = (message || "").trim();
  if (!raw) return "Login failed";
  // Defensive: never show leaked hash/debug suffixes to users.
  return raw.replace(/\s*Hash:\s*\$2[aby]\$[./A-Za-z0-9]+\s*/gi, "").trim();
};

interface LoginPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

const LoginPopup = ({ isOpen, onClose }: LoginPopupProps) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [verifying, setVerifying] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await apiFetch(`/api/auth/login`, {
        method: "POST",
        body: JSON.stringify(formData),
      });

      if (response.status === 502 || response.status === 503) {
        toast.error(t("Backend server is starting up on Render, please wait 30 seconds and retry"));
        return;
      }

      let data: any = {};
      try {
        data = await response.json();
      } catch (err) {
        toast.error(t("Unable to connect to backend server"));
        return;
      }

      if (response.ok && data.token) {
        // Direct login if token is provided
        handleLoginSuccess(data);
        return;
      } else if (response.ok && !data.token) {
        // Handle case where backend explicitly asks for OTP
        if (!data.email) {
          toast.error(t("Email not found for verification"));
          return;
        }

        // Store temp data
        sessionStorage.setItem("temp_user", JSON.stringify({
          username: data.username,
          role: data.role,
          photo_url: data.photo_url,
          user_id: data.user_id,
          email: data.email,
          exam_mode: data.exam_mode,
          _id: data._id,
          full_name: data.full_name,
          first_name: data.first_name,
          last_name: data.last_name,
          course: data.course,
          enrollment_number: data.enrollment_number,
          roll_number: data.roll_number,
        }));

        // Send OTP
        const otpRes = await apiFetch("/api/auth/send-email-otp", {
          method: "POST",
          body: JSON.stringify({ email: data.email })
        });

        if (otpRes.ok) {
          setShowOtpInput(true);
          toast.success(t("Security code sent to {{email}}", { email: data.email }));
        } else {
          toast.error(t("Failed to send verification code"));
        }
      } else {
        toast.error(t(sanitizeAuthErrorMessage(data?.message) || "Invalid username or password"));
      }
    } catch (error) {
      toast.error(t("An error occurred during login. Please check server status."));
    }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpValue.length !== 6) return;

    setVerifying(true);
    try {
      const tempUser = JSON.parse(sessionStorage.getItem("temp_user") || "{}");
      const res = await apiFetch("/api/auth/verify-email-otp", {
        method: "POST",
        body: JSON.stringify({ email: tempUser.email, otp: otpValue })
      });

      if (res.ok) {
        const token = sessionStorage.getItem("temp_token");
        handleLoginSuccess({ ...tempUser, token });
      } else {
        toast.error(t("Invalid or expired code"));
      }
    } catch (err) {
      toast.error(t("Verification failed"));
    } finally {
      setVerifying(false);
    }
  };

  const handleLoginSuccess = (data: any) => {
    toast.success(t("Logged in successfully"));
    if (data.token) {
      sessionStorage.setItem("token", data.token);
    }
    sessionStorage.setItem("user", JSON.stringify({
      username: data.username,
      role: data.role,
      photo_url: data.photo_url,
      user_id: data.user_id,
      exam_mode: data.exam_mode,
      _id: data._id || data.user_id,
      full_name: data.full_name,
      first_name: data.first_name,
      last_name: data.last_name,
      course: data.course,
      enrollment_number: data.enrollment_number,
      roll_number: data.roll_number,
    }));

    sessionStorage.removeItem("temp_token");
    sessionStorage.removeItem("temp_user");

    setTimeout(() => {
      onClose();
      window.location.href = "/dashboard";
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-[9999] w-screen h-screen flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-card rounded-none shadow-2xl border border-border p-8 animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-none hover:bg-muted transition-colors"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-none flex items-center justify-center mx-auto mb-4 border border-primary/20">
            {showOtpInput ? <ShieldAlert className="w-8 h-8 text-primary" /> : <LogIn className="w-8 h-8 text-primary" />}
          </div>
          <h2 className="font-heading font-bold text-2xl text-foreground uppercase tracking-tight">
            {showOtpInput ? t("Verify Identity") : t("Welcome Back")}
          </h2>
          <p className="text-muted-foreground mt-2 text-[10px] font-black uppercase tracking-widest">
            {showOtpInput ? t("Enter the 6-digit code sent to your email") : t("Sign in to your account to continue")}
          </p>
        </div>

        {!showOtpInput ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="login-username" className="text-[10px] font-black text-foreground uppercase tracking-[0.2em] ml-1">{t("Username")}</label>
              <div className="relative group">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  id="login-username"
                  name="username"
                  type="text"
                  required
                  placeholder={t("ENTER USERNAME")}
                  className="w-full pl-10 pr-4 py-3.5 rounded-none border border-border bg-background text-sm text-foreground focus:ring-0 focus:border-primary focus:outline-none transition-all placeholder:text-muted-foreground/50"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="login-password" className="text-[10px] font-black text-foreground uppercase tracking-[0.2em] ml-1">{t("Password")}</label>
              <div className="relative group">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder={t("ENTER PASSWORD")}
                  className="w-full pl-10 pr-12 py-3.5 rounded-none border border-border bg-background text-sm text-foreground focus:ring-0 focus:border-primary focus:outline-none transition-all placeholder:text-muted-foreground/50"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-primary text-primary-foreground text-xs font-black uppercase tracking-[0.3em] hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("AUTHENTICATING...")}
                </>
              ) : (
                t("SIGN IN")
              )}
            </button>
          </form>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={otpValue} onChange={(v) => {
                setOtpValue(v);
                if (v.length === 6) handleVerifyOtp();
              }}>
                <InputOTPGroup className="gap-2">
                  <InputOTPSlot index={0} className="w-10 h-12 rounded-none border-border font-bold" />
                  <InputOTPSlot index={1} className="w-10 h-12 rounded-none border-border font-bold" />
                  <InputOTPSlot index={2} className="w-10 h-12 rounded-none border-border font-bold" />
                  <InputOTPSlot index={3} className="w-10 h-12 rounded-none border-border font-bold" />
                  <InputOTPSlot index={4} className="w-10 h-12 rounded-none border-border font-bold" />
                  <InputOTPSlot index={5} className="w-10 h-12 rounded-none border-border font-bold" />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <button
              onClick={handleVerifyOtp}
              disabled={verifying || otpValue.length !== 6}
              className="w-full py-4 bg-primary text-primary-foreground text-xs font-black uppercase tracking-[0.3em] hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {verifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("VERIFYING...")}
                </>
              ) : (
                <>
                  {t("VERIFY & CONTINUE")} <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <button
              onClick={() => setShowOtpInput(false)}
              className="w-full text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors text-center"
            >
              {t("BACK TO LOGIN")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPopup;
