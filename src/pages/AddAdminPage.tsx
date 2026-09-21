import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Lock, Mail, Phone, ShieldCheck, Send, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

const AddAdminPage = () => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    email: "",
    phone: "",
    fullName: "",
  });
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(formData.email.trim())) {
      toast.error("Please enter a valid email address (e.g. admin@domain.com)");
      return;
    }

    setLoading(true);

    try {
      const response = await apiFetch("/api/auth/create-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: formData.username.trim(),
          password: formData.password,
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          full_name: formData.fullName.trim(),
        }),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Server returned non-JSON response:", text);
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(data.message || "Admin account created successfully");
        setFormData({
          username: "",
          password: "",
          confirmPassword: "",
          email: "",
          phone: "",
          fullName: "",
        });
      } else {
        if (response.status === 401) {
          toast.error("Please log in again to perform this action");
          return;
        }
        toast.error(data.message || "Failed to create admin");
      }
    } catch (error) {
      console.error("Error creating admin:", error);
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Add New Admin</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Create a new system administrator with full operational access.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Admin Identity Section */}
          <Card className="rounded-none border-border shadow-md overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border py-4">
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                Admin Identity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest ml-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input name="fullName" required placeholder="Administrator Name" className="w-full pl-10 pr-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all" value={formData.fullName} onChange={handleChange} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest ml-1">Portal Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input name="username" required placeholder="admin_username" className="w-full pl-10 pr-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all" value={formData.username} onChange={handleChange} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input name="email" type="email" required placeholder="admin@institute.com" className="w-full pl-10 pr-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all" value={formData.email} onChange={handleChange} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest ml-1">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input name="phone" required placeholder="+91 00000 00000" className="w-full pl-10 pr-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all" value={formData.phone} onChange={handleChange} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Section */}
          <Card className="rounded-none border-border shadow-md overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border py-4">
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary" />
                Security Credentials
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest ml-1">Password</label>
                <div className="relative">
                  <input name="password" type={showPwd ? "text" : "password"} required placeholder="••••••••" className="w-full pl-4 pr-10 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all" value={formData.password} onChange={handleChange} />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest ml-1">Confirm Password</label>
                <div className="relative">
                  <input name="confirmPassword" type={showConfirm ? "text" : "password"} required placeholder="••••••••" className="w-full pl-4 pr-10 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all" value={formData.confirmPassword} onChange={handleChange} />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end pt-4 pb-10">
            <button
              type="submit"
              disabled={loading}
              className="bg-primary text-primary-foreground px-10 py-4 rounded-none font-heading font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:opacity-90 transition-all flex items-center gap-3 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Initialize Admin Portal
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default AddAdminPage;
