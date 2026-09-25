import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Shield, Sparkles, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export default function DirectAccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("No direct access token provided in URL.");
      return;
    }

    const verifyToken = async () => {
      try {
        const response = await fetch("/api/auth/verify-magic-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (response.ok && data.success && data.token) {
          localStorage.setItem("token", data.token);
          if (data.role) localStorage.setItem("role", data.role);
          if (data.username) localStorage.setItem("username", data.username);
          if (data.user_id) localStorage.setItem("user_id", data.user_id);

          const userObj = {
            id: data.user_id || data._id,
            username: data.username,
            role: data.role,
            full_name: data.full_name || data.username,
            email: data.email,
          };
          localStorage.setItem("user", JSON.stringify(userObj));

          setStatus("success");
          setTimeout(() => {
            const role = (data.role || "superadmin").toLowerCase();
            if (role === "superadmin" || role === "admin") {
              navigate("/dashboard/superadmin", { replace: true });
            } else if (role === "center") {
              navigate("/dashboard/center", { replace: true });
            } else {
              navigate("/dashboard/student", { replace: true });
            }
          }, 1200);
        } else {
          setStatus("error");
          setErrorMessage(data.message || "Invalid or expired direct access link.");
        }
      } catch (err: any) {
        setStatus("error");
        setErrorMessage("Network error verifying direct access link.");
      }
    };

    verifyToken();
  }, [token, navigate]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md bg-zinc-900/80 border border-zinc-800 backdrop-blur-xl rounded-2xl p-8 shadow-2xl relative z-10 text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary/20 via-primary/40 to-blue-500/30 border border-primary/30 flex items-center justify-center shadow-lg shadow-primary/20">
            {status === "verifying" && <Loader2 className="w-8 h-8 text-primary animate-spin" />}
            {status === "success" && <CheckCircle2 className="w-8 h-8 text-emerald-400" />}
            {status === "error" && <AlertCircle className="w-8 h-8 text-rose-500" />}
          </div>
        </div>

        <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent mb-2">
          {status === "verifying" && "Authenticating Direct Link..."}
          {status === "success" && "Direct Access Granted!"}
          {status === "error" && "Access Verification Failed"}
        </h2>

        <p className="text-zinc-400 text-sm mb-6">
          {status === "verifying" && "Securely validating session token and establishing dashboard credentials."}
          {status === "success" && "Token verified successfully. Redirecting you to the SuperAdmin Workspace..."}
          {status === "error" && (errorMessage || "The link may be expired or already used.")}
        </p>

        {status === "error" && (
          <button
            onClick={() => navigate("/login")}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-primary via-primary/90 to-blue-600 text-white font-medium hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
          >
            <Shield className="w-4 h-4" /> Go to Standard Login
          </button>
        )}

        {status === "success" && (
          <div className="flex items-center justify-center gap-2 text-xs text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20 py-2 px-3 rounded-lg">
            <Sparkles className="w-3.5 h-3.5" /> Direct Access Token Verified
          </div>
        )}
      </div>
    </div>
  );
}
