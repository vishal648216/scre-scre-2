import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  User, 
  Lock, 
  Mail, 
  Phone, 
  ShieldCheck, 
  Send, 
  Loader2, 
  Eye, 
  EyeOff, 
  Building2, 
  GraduationCap, 
  IndianRupee, 
  BookOpen, 
  BookMarked,
  FileText, 
  Users, 
  Headset, 
  Globe, 
  Settings, 
  Check, 
  Sparkles 
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface ActionPermissions {
  view: boolean;
  add: boolean;
  edit: boolean;
  delete: boolean;
}

interface ModulePermissions {
  centers: ActionPermissions;
  students: ActionPermissions;
  finance: ActionPermissions;
  courses: ActionPermissions;
  exams: ActionPermissions;
  staff: ActionPermissions;
  leads: ActionPermissions;
  cms: ActionPermissions;
  library: ActionPermissions;
  settings: ActionPermissions;
}

const defaultModulePermissions: ModulePermissions = {
  centers: { view: true, add: true, edit: true, delete: false },
  students: { view: true, add: true, edit: true, delete: false },
  finance: { view: false, add: false, edit: false, delete: false },
  courses: { view: true, add: false, edit: false, delete: false },
  exams: { view: true, add: true, edit: true, delete: false },
  staff: { view: false, add: false, edit: false, delete: false },
  leads: { view: true, add: true, edit: true, delete: false },
  cms: { view: false, add: false, edit: false, delete: false },
  library: { view: true, add: true, edit: true, delete: false },
  settings: { view: false, add: false, edit: false, delete: false },
};

const fullPermissions: ModulePermissions = {
  centers: { view: true, add: true, edit: true, delete: true },
  students: { view: true, add: true, edit: true, delete: true },
  finance: { view: true, add: true, edit: true, delete: true },
  courses: { view: true, add: true, edit: true, delete: true },
  exams: { view: true, add: true, edit: true, delete: true },
  staff: { view: true, add: true, edit: true, delete: true },
  leads: { view: true, add: true, edit: true, delete: true },
  cms: { view: true, add: true, edit: true, delete: true },
  library: { view: true, add: true, edit: true, delete: true },
  settings: { view: true, add: true, edit: true, delete: true },
};

const modulesConfig = [
  { key: "centers" as keyof ModulePermissions, label: "Centers & Franchises", icon: Building2, desc: "Franchise applications, centers directory, and allocations" },
  { key: "students" as keyof ModulePermissions, label: "Students Management", icon: GraduationCap, desc: "Admissions, student records, batch assignments, and approvals" },
  { key: "finance" as keyof ModulePermissions, label: "Finance & Accounts", icon: IndianRupee, desc: "Wallets, payments, franchise fees, and commission settlements" },
  { key: "courses" as keyof ModulePermissions, label: "Academics & Courses", icon: BookOpen, desc: "Syllabus, course categories, subject mapping, and study materials" },
  { key: "exams" as keyof ModulePermissions, label: "Exams & Marksheets", icon: FileText, desc: "Exam blueprints, test allocation, results, and certificate generation" },
  { key: "staff" as keyof ModulePermissions, label: "Staff & Interns", icon: Users, desc: "Staff directory, internal assignments, and intern task management" },
  { key: "leads" as keyof ModulePermissions, label: "CRM & Enquiries", icon: Headset, desc: "Student queries, admission leads, notes, and follow-ups" },
  { key: "cms" as keyof ModulePermissions, label: "CMS & Website Content", icon: Globe, desc: "Blogs, news updates, tickers, testimonials, and gallery items" },
  { key: "library" as keyof ModulePermissions, label: "Library Management", icon: BookMarked, desc: "E-books catalog, reference manuals, physical book issues & returns" },
  { key: "settings" as keyof ModulePermissions, label: "System Administration", icon: Settings, desc: "Global system configurations, logs, and maintenance toggles" },
];

const AddAdminPage = () => {
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<any[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>("custom");
  const [permissions, setPermissions] = useState<ModulePermissions>(defaultModulePermissions);

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

  useEffect(() => {
    // Fetch pre-configured custom roles if any exist
    apiFetch("/api/admin/roles")
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data)) setRoles(data);
      })
      .catch(() => {});
  }, []);

  const handleApplyPreset = (presetKey: string) => {
    setSelectedPreset(presetKey);
    if (presetKey === "full") {
      setPermissions(JSON.parse(JSON.stringify(fullPermissions)));
    } else if (presetKey === "center_manager") {
      setPermissions({
        centers: { view: true, add: true, edit: true, delete: false },
        students: { view: true, add: true, edit: true, delete: false },
        finance: { view: false, add: false, edit: false, delete: false },
        courses: { view: true, add: false, edit: false, delete: false },
        exams: { view: false, add: false, edit: false, delete: false },
        staff: { view: false, add: false, edit: false, delete: false },
        leads: { view: true, add: true, edit: true, delete: false },
        cms: { view: false, add: false, edit: false, delete: false },
        settings: { view: false, add: false, edit: false, delete: false },
      });
    } else if (presetKey === "exam_controller") {
      setPermissions({
        centers: { view: true, add: false, edit: false, delete: false },
        students: { view: true, add: false, edit: false, delete: false },
        finance: { view: false, add: false, edit: false, delete: false },
        courses: { view: true, add: false, edit: false, delete: false },
        exams: { view: true, add: true, edit: true, delete: true },
        staff: { view: false, add: false, edit: false, delete: false },
        leads: { view: false, add: false, edit: false, delete: false },
        cms: { view: false, add: false, edit: false, delete: false },
        settings: { view: false, add: false, edit: false, delete: false },
      });
    } else if (presetKey === "accounts") {
      setPermissions({
        centers: { view: true, add: false, edit: false, delete: false },
        students: { view: true, add: false, edit: false, delete: false },
        finance: { view: true, add: true, edit: true, delete: false },
        courses: { view: false, add: false, edit: false, delete: false },
        exams: { view: false, add: false, edit: false, delete: false },
        staff: { view: false, add: false, edit: false, delete: false },
        leads: { view: false, add: false, edit: false, delete: false },
        cms: { view: false, add: false, edit: false, delete: false },
        settings: { view: false, add: false, edit: false, delete: false },
      });
    } else {
      // Check if it's a custom saved role from DB
      const matchedRole = roles.find(r => r._id === presetKey || r.id === presetKey);
      if (matchedRole && matchedRole.permissions) {
        setPermissions(matchedRole.permissions);
      }
    }
  };

  const toggleAction = (module: keyof ModulePermissions, action: keyof ActionPermissions) => {
    setSelectedPreset("custom");
    setPermissions(prev => {
      const currentMod = prev[module];
      const newActionVal = !currentMod[action];
      const updatedMod = { ...currentMod, [action]: newActionVal };
      // If adding/editing/deleting, view must automatically be true
      if (action !== "view" && newActionVal) {
        updatedMod.view = true;
      }
      // If disabling view, disable all write actions
      if (action === "view" && !newActionVal) {
        updatedMod.add = false;
        updatedMod.edit = false;
        updatedMod.delete = false;
      }
      return { ...prev, [module]: updatedMod };
    });
  };

  const toggleAllInModule = (module: keyof ModulePermissions) => {
    setSelectedPreset("custom");
    setPermissions(prev => {
      const allActive = prev[module].view && prev[module].add && prev[module].edit && prev[module].delete;
      return {
        ...prev,
        [module]: {
          view: !allActive,
          add: !allActive,
          edit: !allActive,
          delete: !allActive,
        }
      };
    });
  };

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
          role_name: selectedPreset !== "custom" ? selectedPreset : "Custom Sub-Admin",
          permissions: permissions,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        const createdUserId = data.user_id || data._id;
        // Also persist permissions via permissions endpoint if user_id is returned
        if (createdUserId) {
          await apiFetch(`/api/admin/users/${createdUserId}/permissions`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              role_name: selectedPreset !== "custom" ? selectedPreset : "Custom Sub-Admin",
              permissions: permissions,
            })
          }).catch(() => {});
        }

        toast.success(data.message || "Admin account created with permissions successfully");
        setFormData({
          username: "",
          password: "",
          confirmPassword: "",
          email: "",
          phone: "",
          fullName: "",
        });
        setPermissions(defaultModulePermissions);
        setSelectedPreset("custom");
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
      <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Add New Admin</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Create a new sub-administrator and select specific permissions & module access.</p>
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

          {/* Granular Module Permissions Section */}
          <Card className="rounded-none border-border shadow-md overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Access & Permissions Control
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Select which modules and features this administrator is authorized to see and manage.
                </CardDescription>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Preset:</span>
                <button
                  type="button"
                  onClick={() => handleApplyPreset("full")}
                  className={`px-3 py-1 text-[11px] font-bold uppercase transition-all rounded-none border ${
                    selectedPreset === "full" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted text-muted-foreground"
                  }`}
                >
                  Full Access
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset("center_manager")}
                  className={`px-3 py-1 text-[11px] font-bold uppercase transition-all rounded-none border ${
                    selectedPreset === "center_manager" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted text-muted-foreground"
                  }`}
                >
                  Center Manager
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset("exam_controller")}
                  className={`px-3 py-1 text-[11px] font-bold uppercase transition-all rounded-none border ${
                    selectedPreset === "exam_controller" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted text-muted-foreground"
                  }`}
                >
                  Exam Incharge
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset("accounts")}
                  className={`px-3 py-1 text-[11px] font-bold uppercase transition-all rounded-none border ${
                    selectedPreset === "accounts" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted text-muted-foreground"
                  }`}
                >
                  Accounts Lead
                </button>
                {roles.map(r => (
                  <button
                    key={r._id || r.id}
                    type="button"
                    onClick={() => handleApplyPreset(r._id || r.id)}
                    className={`px-3 py-1 text-[11px] font-bold uppercase transition-all rounded-none border ${
                      selectedPreset === (r._id || r.id) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {modulesConfig.map(mod => {
                  const modPerms = permissions[mod.key];
                  const Icon = mod.icon;
                  const isFullyActive = modPerms.view && modPerms.add && modPerms.edit && modPerms.delete;
                  const isPartiallyActive = modPerms.view || modPerms.add || modPerms.edit || modPerms.delete;

                  return (
                    <div 
                      key={mod.key} 
                      className={`p-4 border transition-all rounded-none ${
                        isPartiallyActive ? "border-primary/40 bg-card shadow-sm" : "border-border/60 bg-muted/10 opacity-75"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2 pb-2 border-b border-border/50">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-none ${isPartiallyActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="font-bold text-xs uppercase tracking-tight text-foreground">{mod.label}</h4>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleAllInModule(mod.key)}
                          className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 border ${
                            isFullyActive ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {isFullyActive ? "All On" : "Toggle"}
                        </button>
                      </div>
                      <p className="text-[10px] text-muted-foreground mb-3 line-clamp-2 h-7">{mod.desc}</p>

                      {/* Action Toggles */}
                      <div className="grid grid-cols-4 gap-1.5 text-center">
                        {(["view", "add", "edit", "delete"] as (keyof ActionPermissions)[]).map(act => {
                          const isActive = modPerms[act];
                          return (
                            <button
                              key={act}
                              type="button"
                              onClick={() => toggleAction(mod.key, act)}
                              className={`py-1.5 text-[10px] font-black uppercase tracking-widest border transition-all ${
                                isActive 
                                  ? "bg-primary/15 border-primary text-primary font-extrabold" 
                                  : "border-border/60 text-muted-foreground/60 hover:border-border hover:text-foreground"
                              }`}
                            >
                              {act}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
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
              Create Admin with Assigned Access
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default AddAdminPage;
