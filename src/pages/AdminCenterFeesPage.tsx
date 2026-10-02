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
      const [centerRes, studentRes] = await Promise.all([
        apiFetch("/api/centers"),
        apiFetch("/api/students"),
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-2xl border-zinc-800 bg-zinc-900/90 shadow-xl backdrop-blur-xl hover:border-zinc-700 transition-all">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total Student Fees</p>
                <h3 className="text-2xl font-black text-emerald-400 mt-1">₹{grandTotalCollected.toLocaleString("en-IN")}</h3>
                <p className="text-[10px] text-zinc-500 mt-0.5">Committed: ₹{grandTotalCommitted.toLocaleString("en-IN")}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <IndianRupee className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-zinc-800 bg-zinc-900/90 shadow-xl backdrop-blur-xl hover:border-zinc-700 transition-all">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Super Admin Royalty</p>
                <h3 className="text-2xl font-black text-primary mt-1">₹{grandTotalRoyalty.toLocaleString("en-IN")}</h3>
                <p className="text-[10px] text-primary/80 mt-0.5">Default Share: 15%</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Percent className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-zinc-800 bg-zinc-900/90 shadow-xl backdrop-blur-xl hover:border-zinc-700 transition-all">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Registered Centers</p>
                <h3 className="text-2xl font-black text-zinc-100 mt-1">{centers.length}</h3>
                <p className="text-[10px] text-zinc-500 mt-0.5">Active Franchise Partners</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                <Building2 className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-zinc-800 bg-zinc-900/90 shadow-xl backdrop-blur-xl hover:border-zinc-700 transition-all">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total Students</p>
                <h3 className="text-2xl font-black text-sky-400 mt-1">{students.length}</h3>
                <p className="text-[10px] text-zinc-500 mt-0.5">Across All Centers</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <Users className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Center-wise Fees Table */}
        <Card className="rounded-2xl border-zinc-800 bg-zinc-900/90 shadow-xl overflow-hidden backdrop-blur-xl">
          <CardHeader className="bg-zinc-950/50 border-b border-zinc-800 flex flex-row items-center justify-between py-4 px-6">
            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-zinc-100">
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
              <div className="py-16 text-center text-zinc-400 text-xs font-bold uppercase tracking-widest">
                No center fee data available.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-950/80 text-zinc-400 uppercase text-[11px] font-bold tracking-wider">
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
                  <tbody className="divide-y divide-zinc-800/60">
                    {feeStatsByCenter.map(({ center, studentCount, totalCollectedFees, royaltyRate, royaltyAmount, franchiseFeeAmount, netCenterEarnings }) => (
                      <tr key={center.id} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="py-4 px-6">
                          <div className="font-bold text-sm text-zinc-100">{center.name}</div>
                          <span className="text-[10px] text-zinc-400 font-mono">CODE: {center.code} • Owner: {center.owner_name}</span>
                        </td>

                        <td className="py-4 px-6 font-bold">
                          <span className="px-3 py-1 bg-zinc-950/60 border border-zinc-800 rounded-full text-zinc-300 text-[10px] font-mono">
                            {studentCount} Students
                          </span>
                        </td>

                        <td className="py-4 px-6 font-black text-emerald-400 text-sm">
                          ₹{totalCollectedFees.toLocaleString("en-IN")}
                        </td>

                        <td className="py-4 px-6 font-bold text-amber-400">
                          {royaltyRate}%
                        </td>

                        <td className="py-4 px-6 font-black text-primary text-sm">
                          ₹{royaltyAmount.toLocaleString("en-IN")}
                        </td>

                        <td className="py-4 px-6 font-bold text-zinc-200">
                          ₹{netCenterEarnings.toLocaleString("en-IN")}
                        </td>

                        <td className="py-4 px-6 font-semibold text-zinc-400">
                          ₹{franchiseFeeAmount.toLocaleString("en-IN")}
                        </td>

                        <td className="py-4 px-6 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openSetupModal(center)}
                            className="rounded-xl font-bold text-xs uppercase tracking-wider border-zinc-700 bg-zinc-800/60 hover:bg-zinc-800 text-zinc-200 gap-1.5"
                          >
                            <Settings className="w-3.5 h-3.5 text-primary" /> Setup Fee
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
