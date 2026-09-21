import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserPlus, Shield, Briefcase, Mail, Phone, Lock, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useNavigate } from "react-router-dom";

const AddStaffPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    name: "",
    designation: "",
    role_type: "alternate_staff",
    phone: "",
    email: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        toast.success("Staff member added successfully");
        navigate("/dashboard/staff");
      } else {
        const data = await res.json();
        toast.error(data.message || "Failed to add staff");
      }
    } catch (error) {
      toast.error("Error connecting to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight text-center">Register New Staff</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium uppercase tracking-widest font-black text-[10px] text-center">Onboard a new member to your operational team</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Profile Information */}
            <Card className="rounded-none border-border shadow-md md:col-span-2">
              <CardHeader className="bg-muted/30 border-b border-border py-4">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">Full Name</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input 
                      required
                      type="text" 
                      className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-none text-xs font-bold uppercase focus:outline-none focus:border-primary transition-all"
                      placeholder="ENTER FULL NAME"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">Designation</label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input 
                      required
                      type="text" 
                      className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-none text-xs font-bold uppercase focus:outline-none focus:border-primary transition-all"
                      placeholder="E.G. TEACHER, PEON, ACCOUNTANT"
                      value={formData.designation}
                      onChange={(e) => setFormData({...formData, designation: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">Role Template</label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <select 
                      className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-none text-xs font-bold uppercase focus:outline-none focus:border-primary transition-all"
                      value={formData.role_type}
                      onChange={(e) => setFormData({...formData, role_type: e.target.value})}
                    >
                      <option value="alternate_staff">ALTERNATE STAFF (NO PERMISSIONS)</option>
                      <option value="peon">PEON (VIEW ONLY)</option>
                      <option value="teacher">TEACHER (STUDENTS & ATTENDANCE)</option>
                      <option value="center_admin">CENTER ADMIN (FULL ACCESS)</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input 
                      type="tel" 
                      className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-none text-xs font-bold uppercase focus:outline-none focus:border-primary transition-all"
                      placeholder="ENTER CONTACT NO"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Login Credentials */}
            <Card className="rounded-none border-border shadow-md md:col-span-2">
              <CardHeader className="bg-muted/30 border-b border-border py-4">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary" />
                  Account Credentials
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">Username</label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input 
                      required
                      type="text" 
                      className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-none text-xs font-bold uppercase focus:outline-none focus:border-primary transition-all"
                      placeholder="CREATE USERNAME"
                      value={formData.username}
                      onChange={(e) => setFormData({...formData, username: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input 
                      required
                      type="password" 
                      className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-none text-xs font-bold uppercase focus:outline-none focus:border-primary transition-all"
                      placeholder="CREATE PASSWORD"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-center pt-6">
            <button 
              disabled={loading}
              type="submit"
              className="flex items-center gap-3 px-12 py-4 bg-primary text-primary-foreground text-xs font-black uppercase tracking-[0.3em] hover:opacity-90 transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              Finalize Registration
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default AddStaffPage;
