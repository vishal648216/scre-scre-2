import React, { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { 
  KeyRound, 
  Mail, 
  User, 
  Lock, 
  ArrowRight, 
  CheckCircle2, 
  Loader2, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  ArrowLeft 
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useTranslation } from "react-i18next";

const ForgotPasswordPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Steps: 1 = Identifier input, 2 = OTP & New Password input, 3 = Success
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form states
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Loading states
  const [sendingOtp, setSendingOtp] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [otpHint, setOtpHint] = useState<string | null>(null);

  // Handle Request OTP (Step 1)
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      toast.error(t("Please enter your Username, Email, Phone, or Center Code"));
      return;
    }

    setSendingOtp(true);
    try {
      const res = await apiFetch("/api/auth/forgot-password/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success !== false) {
        toast.success(t(data.message || "Security code sent to your registered email!"));
        if (data.otp) {
          setOtpHint(data.otp);
        }
        setStep(2);
      } else {
        toast.error(t(data.message || "Failed to request password reset code"));
      }
    } catch (error) {
      toast.error(t("Error requesting password reset"));
    } finally {
      setSendingOtp(false);
    }
  };

  // Handle Reset Password (Step 2)
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || otp.length !== 6) {
      toast.error(t("Please enter the 6-digit verification code"));
      return;
    }

    if (!newPassword.trim()) {
      toast.error(t("Please enter a new password"));
      return;
    }

    if (newPassword.length < 4) {
      toast.error(t("Password must be at least 4 characters long"));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t("Passwords do not match"));
      return;
    }

    setResettingPassword(true);
    try {
      const res = await apiFetch("/api/auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          otp: otp.trim(),
          new_password: newPassword.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success !== false) {
        toast.success(t("Password reset successfully!"));
        setStep(3);
      } else {
        toast.error(t(data.message || "Failed to reset password"));
      }
    } catch (error) {
      toast.error(t("Error resetting password"));
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-grow flex items-center justify-center pt-28 pb-16 px-4">
        <div className="max-w-md w-full bg-card rounded-none shadow-2xl border border-border p-8 animate-in fade-in duration-300">
          
          {/* Header Icon & Title */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary/10 rounded-none flex items-center justify-center mx-auto mb-4 border border-primary/20">
              {step === 3 ? (
                <CheckCircle2 className="w-8 h-8 text-emerald-500 animate-bounce" />
              ) : (
                <KeyRound className="w-8 h-8 text-primary" />
              )}
            </div>
            <h1 className="font-heading font-extrabold text-2xl text-foreground uppercase tracking-tight">
              {step === 1 && t("Forgot Password")}
              {step === 2 && t("Reset Password")}
              {step === 3 && t("Password Reset Complete")}
            </h1>
            <p className="text-muted-foreground mt-2 text-xs font-medium">
              {step === 1 && t("Enter your registered Username, Email, Phone, Center Code or Roll No.")}
              {step === 2 && t("Enter the 6-digit OTP code sent to your registered account & set your new password.")}
              {step === 3 && t("Your password has been updated successfully. You can now log in.")}
            </p>
          </div>

          {/* STEP 1: Enter Identifier */}
          {step === 1 && (
            <form onSubmit={handleRequestOtp} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground">
                  {t("Username / Email / Phone / Code")}
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. admin, student@example.com, CENTER-001"
                    className="w-full pl-10 pr-4 py-3.5 border border-border bg-background text-sm font-semibold focus:border-primary focus:outline-none rounded-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={sendingOtp}
                className="w-full py-4 bg-primary text-primary-foreground text-xs font-black uppercase tracking-[0.25em] hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {sendingOtp ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("Sending Security Code...")}
                  </>
                ) : (
                  <>
                    {t("Send Verification Code")} <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <Link
                  to="/franchise/login"
                  className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {t("Back to Login")}
                </Link>
              </div>
            </form>
          )}

          {/* STEP 2: Enter OTP & New Password */}
          {step === 2 && (
            <form onSubmit={handleResetPassword} className="space-y-6">
              {/* OTP Field */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground">
                    {t("6-Digit Verification Code")}
                  </label>
                  {otpHint && (
                    <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5">
                      OTP: {otpHint}
                    </span>
                  )}
                </div>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otp} onChange={(val) => setOtp(val)}>
                    <InputOTPGroup className="gap-2">
                      <InputOTPSlot index={0} className="w-10 h-12 rounded-none border-border font-bold text-base" />
                      <InputOTPSlot index={1} className="w-10 h-12 rounded-none border-border font-bold text-base" />
                      <InputOTPSlot index={2} className="w-10 h-12 rounded-none border-border font-bold text-base" />
                      <InputOTPSlot index={3} className="w-10 h-12 rounded-none border-border font-bold text-base" />
                      <InputOTPSlot index={4} className="w-10 h-12 rounded-none border-border font-bold text-base" />
                      <InputOTPSlot index={5} className="w-10 h-12 rounded-none border-border font-bold text-base" />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground">
                  {t("New Password")}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full pl-10 pr-12 py-3.5 border border-border bg-background text-sm font-semibold focus:border-primary focus:outline-none rounded-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground">
                  {t("Confirm New Password")}
                </label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full pl-10 pr-4 py-3.5 border border-border bg-background text-sm font-semibold focus:border-primary focus:outline-none rounded-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={resettingPassword}
                className="w-full py-4 bg-primary text-primary-foreground text-xs font-black uppercase tracking-[0.25em] hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {resettingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("Resetting Password...")}
                  </>
                ) : (
                  <>
                    {t("Reset Password Now")} <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="flex justify-between items-center text-xs font-bold pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {t("Back")}
                </button>
                <button
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={sendingOtp}
                  className="text-primary hover:underline uppercase tracking-wider"
                >
                  {t("Resend OTP")}
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Success Screen */}
          {step === 3 && (
            <div className="space-y-6 text-center animate-in zoom-in-95 duration-200">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-bold uppercase tracking-wider">
                {t("Your password has been changed successfully!")}
              </div>

              <button
                onClick={() => navigate("/franchise/login")}
                className="w-full py-4 bg-primary text-primary-foreground text-xs font-black uppercase tracking-[0.25em] hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                {t("Proceed to Login")} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ForgotPasswordPage;
