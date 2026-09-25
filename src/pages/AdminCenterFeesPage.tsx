import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IndianRupee, Loader2, Building2, Percent, Settings, CheckCircle2, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Center {
  id: string;
  user_id: string;
  name: string;
  code: string;
  owner_name: string;
  city?: string;
  state?: string;
  config_validity?: {
    franchise_fee?: number;
    royalty_percent?: number;
  };
}

interface StudentRow {
  _id?: any;
  parent_id?: string;
  total_fees?: number;
  paid_amount?: number;
  grand_total?: number;
}

const AdminCenterFeesPage = () => {
  const [loading, setLoading] = useState(true);
  const [centers, setCenters] = useState<Center[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  
  // Fee Setup Modal
  const [selectedCenter, setSelectedCenter] = useState<Center | null>(null);
  const [franchiseFee, setFranchiseFee] = useState<number>(50000);
  const [royaltyPercent, setRoyaltyPercent] = useState<number>(15);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("token");
      const [centerRes, studentRes] = await Promise.all([
        apiFetch("/api/centers"),
        fetch("/api/students", { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (centerRes.ok) {
        const centerData = await centerRes.json();
        setCenters(Array.isArray(centerData) ? centerData : []);
      }
      if (studentRes.ok) {
        const studentData = await studentRes.json();
        setStudents(Array.isArray(studentData) ? studentData : []);
      }
    } catch (error) {
      toast.error("Failed to load fee collection data");
    } finally {
      setLoading(false);
    }
  };

  const toId = (v: any): string => {
    if (!v) return "";
    if (typeof v === "string") return v;
    if (v && typeof v === "object" && "$oid" in v) return v.$oid;
    return String(v);
  };

  // Group student fee collection by center user_id
  const feeStatsByCenter = centers.map(center => {
    const centerUserId = toId(center.user_id) || toId(center.id);
    const centerStudents = students.filter(s => toId(s.parent_id) === centerUserId);
    
    const studentCount = centerStudents.length;
    const totalCommittedFees = centerStudents.reduce((acc, s) => acc + (s.total_fees || s.grand_total || 0), 0);
    const totalCollectedFees = centerStudents.reduce((acc, s) => acc + (s.paid_amount || 0), 0);
    
    const royaltyRate = center.config_validity?.royalty_percent ?? 15;
    const royaltyAmount = (totalCollectedFees * royaltyRate) / 100;
    const franchiseFeeAmount = center.config_validity?.franchise_fee ?? 50000;
    const netCenterEarnings = totalCollectedFees - royaltyAmount;

    return {
      center,
      studentCount,
      totalCommittedFees,
      totalCollectedFees,
      royaltyRate,
      royaltyAmount,
      franchiseFeeAmount,
      netCenterEarnings
    };
  });

  const grandTotalCollected = feeStatsByCenter.reduce((acc, f) => acc + f.totalCollectedFees, 0);
  const grandTotalRoyalty = feeStatsByCenter.reduce((acc, f) => acc + f.royaltyAmount, 0);
  const grandTotalCommitted = feeStatsByCenter.reduce((acc, f) => acc + f.totalCommittedFees, 0);

  const openSetupModal = (c: Center) => {
    setSelectedCenter(c);
    setFranchiseFee(c.config_validity?.franchise_fee ?? 50000);
    setRoyaltyPercent(c.config_validity?.royalty_percent ?? 15);
  };

  const handleSaveFeeSetup = async () => {
    if (!selectedCenter) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/centers/${selectedCenter.id}`, {
        method: "PUT",
        body: JSON.stringify({
          config_validity: {
            ...selectedCenter.config_validity,
            franchise_fee: franchiseFee,
            royalty_percent: royaltyPercent,
          }
        })
      });

      if (res.ok) {
        toast.success(`Fee structure updated for ${selectedCenter.name}`);
        setSelectedCenter(null);
        fetchData();
      } else {
        toast.error("Failed to update fee configuration");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight flex items-center gap-3">
            <IndianRupee className="w-8 h-8 text-primary" />
            Franchise Fees & Revenue Dashboard
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Monitor center-wise student fee collection, Super Admin royalty share (15%), and configure center franchise setup.
          </p>
        </div>

        {/* Top Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="rounded-none border-border bg-card p-6 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Student Fees Collected</p>
            <div className="text-2xl font-extrabold text-emerald-600 flex items-center gap-1">
              ₹{grandTotalCollected.toLocaleString("en-IN")}
            </div>
            <p className="text-[10px] text-muted-foreground font-bold">Committed: ₹{grandTotalCommitted.toLocaleString("en-IN")}</p>
          </Card>

          <Card className="rounded-none border-border bg-card p-6 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Super Admin Royalty Earned</p>
            <div className="text-2xl font-extrabold text-primary flex items-center gap-1">
              ₹{grandTotalRoyalty.toLocaleString("en-IN")}
            </div>
            <p className="text-[10px] text-muted-foreground font-bold">Default Share: 15%</p>
          </Card>

          <Card className="rounded-none border-border bg-card p-6 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Registered Centers</p>
            <div className="text-2xl font-extrabold text-foreground flex items-center gap-1">
              {centers.length}
            </div>
            <p className="text-[10px] text-muted-foreground font-bold">Active Franchise Partners</p>
          </Card>

          <Card className="rounded-none border-border bg-card p-6 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Enrolled Students</p>
            <div className="text-2xl font-extrabold text-foreground flex items-center gap-1">
              {students.length}
            </div>
            <p className="text-[10px] text-muted-foreground font-bold">Across All Centers</p>
          </Card>
        </div>

        {/* Center-wise Fees Table */}
        <Card className="rounded-none border-border overflow-hidden">
          <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between py-4">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              Center-Wise Fee Collection & Royalty Setup
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : feeStatsByCenter.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-xs font-bold uppercase tracking-widest">
                No center fee data available.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/20 text-muted-foreground uppercase text-[10px] font-black tracking-widest">
                      <th className="py-4 px-6">Center Details</th>
                      <th className="py-4 px-6">Students</th>
                      <th className="py-4 px-6">Student Fees Collected</th>
                      <th className="py-4 px-6">Royalty %</th>
                      <th className="py-4 px-6">SuperAdmin Royalty</th>
                      <th className="py-4 px-6">Net Center Share</th>
                      <th className="py-4 px-6">Franchise Fee</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {feeStatsByCenter.map(({ center, studentCount, totalCollectedFees, royaltyRate, royaltyAmount, franchiseFeeAmount, netCenterEarnings }) => (
                      <tr key={center.id} className="hover:bg-muted/10 transition-colors">
                        <td className="py-4 px-6">
                          <div className="font-black text-sm uppercase text-foreground">{center.name}</div>
                          <span className="text-[10px] text-muted-foreground font-mono">CODE: {center.code} • Owner: {center.owner_name}</span>
                        </td>

                        <td className="py-4 px-6 font-bold">
                          <span className="px-2.5 py-1 bg-muted border border-border text-[10px] font-mono">
                            {studentCount} Students
                          </span>
                        </td>

                        <td className="py-4 px-6 font-extrabold text-emerald-600">
                          ₹{totalCollectedFees.toLocaleString("en-IN")}
                        </td>

                        <td className="py-4 px-6 font-bold text-amber-600">
                          {royaltyRate}%
                        </td>

                        <td className="py-4 px-6 font-extrabold text-primary">
                          ₹{royaltyAmount.toLocaleString("en-IN")}
                        </td>

                        <td className="py-4 px-6 font-extrabold text-foreground">
                          ₹{netCenterEarnings.toLocaleString("en-IN")}
                        </td>

                        <td className="py-4 px-6 font-bold text-muted-foreground">
                          ₹{franchiseFeeAmount.toLocaleString("en-IN")}
                        </td>

                        <td className="py-4 px-6 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openSetupModal(center)}
                            className="rounded-none font-black text-[10px] uppercase tracking-wider border-primary/30 text-primary hover:bg-primary/10 gap-1"
                          >
                            <Settings className="w-3.5 h-3.5" /> Setup Fee
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fee Setup Modal */}
        {selectedCenter && (
          <Dialog open={!!selectedCenter} onOpenChange={() => setSelectedCenter(null)}>
            <DialogContent className="max-w-md rounded-none border-2 border-border p-6">
              <DialogHeader className="border-b border-border pb-3">
                <DialogTitle className="font-black uppercase tracking-tight text-lg flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" />
                  Configure Center Fee Setup
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-3">
                <div className="bg-muted/40 p-3 border border-border space-y-1 text-xs font-bold">
                  <p className="text-foreground">Center: <span className="text-primary">{selectedCenter.name}</span></p>
                  <p className="text-muted-foreground">Code: {selectedCenter.code}</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Franchise Fee (₹):
                  </label>
                  <input
                    type="number"
                    value={franchiseFee}
                    onChange={(e) => setFranchiseFee(Number(e.target.value))}
                    className="w-full p-2.5 rounded-none border border-border bg-background text-xs font-bold focus:border-primary outline-none"
                    placeholder="Enter franchise fee amount"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Super Admin Royalty Percentage (%):
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={royaltyPercent}
                    onChange={(e) => setRoyaltyPercent(Number(e.target.value))}
                    className="w-full p-2.5 rounded-none border border-border bg-background text-xs font-bold focus:border-primary outline-none"
                    placeholder="Enter royalty percentage"
                  />
                  <p className="text-[10px] text-muted-foreground">Standard royalty share is 15% of collected student fees.</p>
                </div>
              </div>

              <DialogFooter className="border-t border-border pt-3 gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedCenter(null)}
                  className="rounded-none font-bold text-xs uppercase tracking-widest"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveFeeSetup}
                  disabled={saving}
                  className="rounded-none font-black text-xs uppercase tracking-widest gap-2 bg-primary text-primary-foreground hover:opacity-90"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Save Setup
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminCenterFeesPage;
