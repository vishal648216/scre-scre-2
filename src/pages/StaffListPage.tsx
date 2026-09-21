import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, Search, Loader2, PlusCircle, List, Shield, Mail, Phone, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

interface StaffMember {
  _id: string;
  name: string;
  username: string;
  designation: string;
  role_type: string;
  email?: string;
  phone?: string;
  status: string;
}

const StaffListPage = () => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/staff");
      if (res.ok) {
        const data = await res.json();
        setStaff(data);
      }
    } catch (error) {
      toast.error("Failed to load staff list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const filteredStaff = staff.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.designation.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Staff Directory</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium uppercase tracking-widest font-black text-[10px]">Manage your center or admin operational team</p>
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="SEARCH STAFF..." 
              className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-none text-xs font-bold uppercase focus:outline-none focus:border-primary transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStaff.map((member) => (
              <Card key={member._id} className="rounded-none border-border shadow-md hover:border-primary/20 transition-all group overflow-hidden">
                <div className={cn(
                  "h-1.5 w-full",
                  member.role_type === "center_admin" ? "bg-primary" :
                  member.role_type === "teacher" ? "bg-blue-500" :
                  "bg-muted"
                )} />
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-muted flex items-center justify-center rounded-none group-hover:scale-110 transition-transform">
                      <Users className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-[0.2em] px-2 py-1 border",
                      member.status === "active" ? "text-green-600 border-green-600/20 bg-green-600/5" : "text-muted-foreground border-border bg-muted/5"
                    )}>
                      {member.status}
                    </span>
                  </div>
                  
                  <div className="space-y-1">
                    <h3 className="font-black text-lg uppercase tracking-tight leading-none">{member.name}</h3>
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">{member.designation}</p>
                  </div>

                  <div className="mt-6 space-y-3">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Shield className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-tight">{member.username}</span>
                    </div>
                    {member.email && (
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <Mail className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold lowercase truncate">{member.email}</span>
                      </div>
                    )}
                    {member.phone && (
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <Phone className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-tight">{member.phone}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-8 flex gap-2 border-t border-border pt-4">
                    <button className="flex-1 py-2 text-[9px] font-black uppercase tracking-widest bg-muted hover:bg-primary hover:text-white transition-all">Edit Details</button>
                    <button className="flex-1 py-2 text-[9px] font-black uppercase tracking-widest text-destructive hover:bg-destructive hover:text-white transition-all border border-destructive/10">Terminate</button>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {filteredStaff.length === 0 && (
              <div className="col-span-full py-20 text-center border-2 border-dashed border-border">
                <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">No staff members found</p>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StaffListPage;
