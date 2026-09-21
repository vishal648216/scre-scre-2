import React, { useState } from 'react';
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { 
  LogIn, 
  Lock, 
  User, 
  ArrowRight, 
  ShieldCheck, 
  LayoutDashboard,
  Eye,
  EyeOff,
  ShieldAlert
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const sanitizeAuthErrorMessage = (message?: string) => {
  const raw = (message || "").trim();
  if (!raw) return "Invalid credentials";
  // Defensive: never show leaked hash/debug suffixes to users.
  return raw.replace(/\s*Hash:\s*\$2[aby]\$[./A-Za-z0-9]+\s*/gi, "").trim();
};

const FranchiseLoginPage = () => {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: ""
  });
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      
      if (res.ok && data.token) {
        // Direct login if token is provided
        sessionStorage.setItem("token", data.token);
        sessionStorage.setItem("user", JSON.stringify({
          username: data.username,
          role: data.role,
          photo_url: data.photo_url,
          user_id: data.user_id,
          email: data.email,
        }));
        toast.success(t("Login successful! Redirecting..."));
        navigate("/dashboard");
        return;
      } else if (res.ok && !data.token) {
        // Handle case where backend explicitly asks for OTP (if we re-enable it later)
        const email = data.email;
        if (!email) {
          toast.error(t("Email not found for verification"));
          return;
        }

        // Store temporary session info
        sessionStorage.setItem("temp_user", JSON.stringify(data));
        
        // Send OTP
        const otpRes = await apiFetch("/api/auth/send-email-otp", {
          method: "POST",
          body: JSON.stringify({ email })
        });

        if (otpRes.ok) {
          setShowOtpInput(true);
          setOtpSent(true);
          toast.success(t("Security code sent to {{email}}", { email }));
        } else {
          toast.error(t("Failed to send verification code"));
        }
      } else {
        toast.error(t(sanitizeAuthErrorMessage(data?.message)));
      }
      } catch (err) {
        toast.error(t("An error occurred during login."));
      } finally {
        setLoading(false);
      }
    };

    const handleVerifyOtp = async () => {
      if (otpValue.length !== 6) return;
      
      setVerifying(true);
      try {
        const user = JSON.parse(sessionStorage.getItem("temp_user") || "{}");
        const res = await apiFetch("/api/auth/verify-email-otp", {
          method: "POST",
          body: JSON.stringify({ email: user.email, otp: otpValue })
        });

        if (res.ok) {
          const token = sessionStorage.getItem("temp_token");
          sessionStorage.setItem("token", token!);
          sessionStorage.setItem("user", JSON.stringify(user));
          sessionStorage.removeItem("temp_token");
          sessionStorage.removeItem("temp_user");
          
          toast.success(t("Identity verified! Redirecting..."));
          navigate("/dashboard");
        } else {
          toast.error(t("Invalid or expired code"));
        }
      } catch (err) {
        toast.error(t("Verification failed"));
      } finally {
        setVerifying(false);
      }
    };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      
      <main className="flex-grow flex items-center justify-center pt-32 pb-20 px-4">
        <div className="max-w-5xl w-full bg-white rounded-[40px] shadow-2xl shadow-slate-200 overflow-hidden flex flex-col lg:flex-row border border-slate-100">
          
          {/* Left Side: Branding/Illustration */}
          <div className="lg:w-[45%] bg-slate-950 p-12 lg:p-16 text-white relative overflow-hidden flex flex-col justify-between">
            {/* Background Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:30px_30px]" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[100px] -mr-32 -mt-32" />
            
            <div className="relative z-10">
              <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-10 shadow-lg shadow-primary/20">
                <ShieldCheck className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl font-black uppercase tracking-tighter leading-tight mb-6">
                {t("SCRE")}<br/>{t("Partner Portal")}
              </h1>
              <p className="text-slate-400 font-medium leading-relaxed">
                {t("Access your center dashboard to manage students, exams, and operations with our integrated ERP system.")}
              </p>
            </div>

            <div className="relative z-10 space-y-6 pt-12 border-t border-white/10">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                  <LayoutDashboard className="w-5 h-5 text-primary" />
                </div>
                <p className="text-sm font-bold uppercase tracking-widest text-slate-300">{t("Real-time Analytics")}</p>
              </div>
              <p className="text-xs text-slate-500 font-medium leading-relaxed italic">
                "{t("Empowering educational leaders with the world's most intuitive management platform.")}"
              </p>
            </div>
          </div>

          {/* Right Side: Login Form */}
          <div className="flex-1 p-10 lg:p-16 flex flex-col justify-center">
            <div className="max-w-sm mx-auto w-full">
              {!showOtpInput ? (
                <>
                  <h2 className="text-3xl font-black text-slate-900 mb-2 uppercase tracking-tighter">{t("Welcome Back")}</h2>
                  <p className="text-slate-500 font-medium mb-10">{t("Enter your credentials to access the portal.")}</p>

                  <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="username" className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t("Username / ID")}</Label>
                      <div className="relative">
                        <input 
                          id="username" 
                          type="text" 
                          placeholder="CENTER-001" 
                          className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-14 text-sm font-bold focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all"
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                          required
                        />
                        <User className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t("Password")}</Label>
                        <Link to="/forgot-password" className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">
                          {t("Forgot?")}
                        </Link>
                      </div>
                      <div className="relative">
                        <input 
                          id="password" 
                          type={showPassword ? "text" : "password"} 
                          placeholder="••••••••" 
                          className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-14 text-sm font-bold focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          required
                        />
                        <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                        <button 
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      disabled={loading}
                      className="w-full h-14 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100"
                    >
                      {loading ? t("Authenticating...") : t("Login to Portal")} <ArrowRight className="w-5 h-5" />
                    </button>

                    <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {t("New center partner?")} <Link to="/franchise/apply" className="text-primary font-bold hover:underline">{t("Apply for Franchise")}</Link>
                    </p>
                  </form>
                </>
              ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-8">
                    <ShieldAlert className="w-8 h-8" />
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 mb-2 uppercase tracking-tighter">{t("Verify Identity")}</h2>
                  <p className="text-slate-500 font-medium mb-10">{t("We've sent a 6-digit security code to your registered email address.")}</p>

                  <div className="space-y-8">
                    <div className="flex justify-center">
                      <InputOTP maxLength={6} value={otpValue} onChange={(v) => {
                        setOtpValue(v);
                        if (v.length === 6) handleVerifyOtp();
                      }}>
                        <InputOTPGroup className="gap-2">
                          <InputOTPSlot index={0} className="w-12 h-14 rounded-xl border-slate-200 text-lg font-black" />
                          <InputOTPSlot index={1} className="w-12 h-14 rounded-xl border-slate-200 text-lg font-black" />
                          <InputOTPSlot index={2} className="w-12 h-14 rounded-xl border-slate-200 text-lg font-black" />
                          <InputOTPSlot index={3} className="w-12 h-14 rounded-xl border-slate-200 text-lg font-black" />
                          <InputOTPSlot index={4} className="w-12 h-14 rounded-xl border-slate-200 text-lg font-black" />
                          <InputOTPSlot index={5} className="w-12 h-14 rounded-xl border-slate-200 text-lg font-black" />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>

                    <button 
                      onClick={handleVerifyOtp}
                      disabled={verifying || otpValue.length !== 6}
                      className="w-full h-14 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100"
                    >
                      {verifying ? t("Verifying...") : t("Verify & Continue")}
                      <ArrowRight className="w-5 h-5" />
                    </button>

                    <div className="flex flex-col gap-4 text-center">
                      <button 
                        onClick={() => setShowOtpInput(false)}
                        className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-primary transition-colors"
                      >
                        {t("Back to Login")}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default FranchiseLoginPage;
