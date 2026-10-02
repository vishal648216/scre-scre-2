import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  ShieldCheck, 
  Users, 
  Check, 
  X, 
  Loader2, 
  Save, 
  Search,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

interface StaffRolePermissions {
  can_manage_students: boolean;
  can_manage_attendance: boolean;
  can_manage_fees: boolean;
  can_manage_courses: boolean;
  can_manage_exams: boolean;
  can_manage_staff: boolean;
}

interface StaffMember {
  _id: string;
  name: string;
  email: string;
  role_type?: string;
  designation?: string;
  center_id?: string;
  center_name?: string;
  permissions?: StaffRolePermissions;
}

const DEFAULT_PERMISSIONS: StaffRolePermissions = {
  can_manage_students: true,
  can_manage_attendance: true,
  can_manage_fees: false,
  can_manage_courses: false,
  can_manage_exams: true,
  can_manage_staff: false
};

const permissionDefinitions = [
  { key: "can_manage_students", title: "Student Directory & Admissions", desc: "Allow creating, editing, and managing student profiles" },
  { key: "can_manage_attendance", title: "Attendance Register & Logs", desc: "Allow marking and editing student & staff attendance" },
  { key: "can_manage_fees", title: "Fee Collection & Receipts", desc: "Allow collecting student fees and issuing fee receipts" },
  { key: "can_manage_courses", title: "Course & Subject Materials", desc: "Allow uploading and managing course study materials" },
  { key: "can_manage_exams", title: "Examination & Marks Entry", desc: "Allow paper downloads, marks entry, and result publishing" },
  { key: "can_manage_staff", title: "Staff Directory Access", desc: "Allow viewing and managing co-staff members" },
];

const AdminStaffRolesPage = () => {
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/staff");
      if (res.ok) {
        const data = await res.json();
        setStaff(Array.isArray(data) ? data : []);
      }
    } catch {
      toast.error("Failed to load staff list");
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (staffId: string, permKey: keyof StaffRolePermissions) => {
    setStaff(prev => prev.map(member => {
      if (member._id !== staffId) return member;
      const current = member.permissions || { ...DEFAULT_PERMISSIONS };
      return {
        ...member,
        permissions: {
          ...current,
          [permKey]: !current[permKey]
        }
      };
    }));
  };

  const handleSavePermissions = async (member: StaffMember) => {
    setSavingId(member._id);
    try {
      const res = await apiFetch(`/api/staff/${member._id}`, {
        method: "PUT",
        body: JSON.stringify({
          permissions: member.permissions || DEFAULT_PERMISSIONS
        })
      });
      if (res.ok) {
        toast.success(`Updated role permissions for ${member.name}`);
      } else {
        toast.error("Failed to save permissions");
      }
    } catch {
      toast.error("Error connecting to server");
    } finally {
      setSavingId(null);
    }
  };

  const filteredStaff = staff.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    (s.designation && s.designation.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
        {/* Banner */}
        <div className="bg-card border border-border rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest mb-2">
              <Sparkles className="w-3 h-3" /> Staff Access Management
            </div>
            <h1 className="font-heading font-black text-2xl md:text-3xl text-foreground uppercase tracking-tight flex items-center gap-3">
              <ShieldCheck className="w-7 h-7 text-primary" />
              Staff Roles & Access Permissions Matrix
            </h1>
            <p className="text-muted-foreground mt-1 text-xs md:text-sm font-medium">
              Granular role-based access control (RBAC) for instructors, center counselors, and staff members.
            </p>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter staff by name or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-2xl border border-border bg-muted/20 text-foreground text-xs font-bold outline-none focus:border-primary transition-all"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider">Loading Permission Matrix...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredStaff.map((member) => {
              const perms = member.permissions || DEFAULT_PERMISSIONS;
              const isSaving = savingId === member._id;

              return (
                <Card key={member._id} className="rounded-3xl bg-card border border-border overflow-hidden shadow-lg">
                  <CardHeader className="bg-muted/40 border-b border-border py-4 px-6 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-black">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                          {member.name}
                          <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider rounded-full px-2.5 py-0.5">
                            {member.designation || member.role_type || "Staff Member"}
                          </Badge>
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5 font-medium">{member.email}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleSavePermissions(member)}
                      disabled={isSaving}
                      className="px-5 py-2.5 rounded-2xl bg-primary hover:opacity-90 text-primary-foreground font-black text-xs uppercase tracking-wider transition flex items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-40"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {isSaving ? "Saving..." : "Save Role Matrix"}
                    </button>
                  </CardHeader>

                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {permissionDefinitions.map((def) => {
                        const key = def.key as keyof StaffRolePermissions;
                        const isGranted = Boolean(perms[key]);

                        return (
                          <div
                            key={def.key}
                            onClick={() => togglePermission(member._id, key)}
                            className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start justify-between gap-3 select-none ${
                              isGranted
                                ? "bg-primary/10 border-primary/40 text-foreground shadow-sm"
                                : "bg-muted/20 border-border text-muted-foreground hover:border-border/80"
                            }`}
                          >
                            <div className="space-y-1">
                              <h4 className="font-bold text-xs text-foreground flex items-center gap-2">
                                {def.title}
                              </h4>
                              <p className="text-[10px] text-muted-foreground leading-relaxed font-medium">{def.desc}</p>
                            </div>

                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 border ${
                              isGranted ? "bg-primary border-primary text-primary-foreground" : "bg-card border-border text-muted-foreground"
                            }`}>
                              {isGranted ? <Check className="w-4 h-4 stroke-[3]" /> : <X className="w-3.5 h-3.5" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {filteredStaff.length === 0 && (
              <Card className="rounded-3xl bg-card border border-border p-12 text-center text-muted-foreground space-y-3">
                <Users className="w-12 h-12 mx-auto text-muted-foreground/50" />
                <p className="text-sm font-bold text-foreground uppercase">No Staff Members Found</p>
                <p className="text-xs font-medium">Add staff members in Staff Directory to configure role permissions.</p>
              </Card>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminStaffRolesPage;
