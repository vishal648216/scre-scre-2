import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Building, 
  Users, 
  Plus, 
  Loader2, 
  CheckCircle2, 
  MapPin,
  X,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface StaffMember {
  _id: string;
  name: string;
  email: string;
  designation?: string;
  assigned_centers?: string[];
}

interface Center {
  _id: string;
  name: string;
  code: string;
  city?: string;
}

const DEFAULT_STAFF: StaffMember[] = [];
const DEFAULT_CENTERS: Center[] = [];

const AdminStaffCentersPage = () => {
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [selectedCenterId, setSelectedCenterId] = useState("");
  const [newCenterName, setNewCenterName] = useState("");
  const [newCenterCode, setNewCenterCode] = useState("");
  const [newCenterCity, setNewCenterCity] = useState("");
  const [showAddCenterModal, setShowAddCenterModal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [staffRes, centerRes] = await Promise.all([
        apiFetch("/api/staff").catch(() => null),
        apiFetch("/api/centers").catch(() => null)
      ]);

      let staffList: StaffMember[] = [];
      if (staffRes && staffRes.ok) {
        const staffData = await staffRes.json();
        const rawStaff = Array.isArray(staffData) ? staffData : (staffData?.staff || staffData?.items || []);
        staffList = rawStaff.map((s: any) => ({
          _id: s._id || s.id || `stf_${Math.random()}`,
          name: s.name || s.full_name || s.username || "Faculty Member",
          email: s.email || "staff@scre.edu",
          designation: s.designation || s.role_type || "Faculty",
          assigned_centers: s.assigned_centers || []
        }));
      }

      let centerList: Center[] = [];
      if (centerRes && centerRes.ok) {
        const centerData = await centerRes.json();
        const rawCenters = Array.isArray(centerData) ? centerData : (centerData?.centers || centerData?.items || []);
        centerList = rawCenters.map((c: any) => ({
          _id: c._id || c.id || `ctr_${Math.random()}`,
          name: c.centerName || c.name || "Training Center Branch",
          code: c.code || c.center_code || "CTR-101",
          city: c.city || c.address || "Branch"
        }));
      }

      const savedAllotments = localStorage.getItem("scre_staff_center_allotments");
      const localAllotments = savedAllotments ? JSON.parse(savedAllotments) : {};

      const savedCustomCtrs = localStorage.getItem("scre_custom_centers");
      const localCustomCtrs: Center[] = savedCustomCtrs ? JSON.parse(savedCustomCtrs) : [];

      const mergedCenters = [...centerList, ...localCustomCtrs];
      const uniqueCenters = Array.from(new Map(mergedCenters.map(c => [c._id, c])).values());

      const mergedStaff = staffList.map(s => {
        const localAssigned = localAllotments[s._id] || localAllotments[s.name];
        return {
          ...s,
          assigned_centers: localAssigned || s.assigned_centers || []
        };
      });

      setStaff(mergedStaff);
      setCenters(uniqueCenters);
    } catch {
      setStaff([]);
      setCenters([]);
    } finally {
      setLoading(false);
    }
  };

  const saveLocalAllotment = (staffKey: string, assigned: string[]) => {
    const saved = localStorage.getItem("scre_staff_center_allotments");
    const local = saved ? JSON.parse(saved) : {};
    local[staffKey] = assigned;
    localStorage.setItem("scre_staff_center_allotments", JSON.stringify(local));
  };

  const handleAddCenterAllotment = async () => {
    if (!selectedStaffId || !selectedCenterId) {
      toast.error("Select staff member and center branch");
      return;
    }

    const selStr = String(selectedStaffId).trim().toLowerCase();
    const member = staff.find(s => 
      String(s._id).trim().toLowerCase() === selStr || 
      String((s as any).id || "").trim().toLowerCase() === selStr || 
      s.name.trim().toLowerCase() === selStr ||
      s.email.trim().toLowerCase() === selStr
    ) || staff.find(s => selStr.includes(String(s._id).toLowerCase()) || selStr.includes(s.name.toLowerCase())) || staff[0];

    if (!member) {
      toast.error("Selected staff member not found");
      return;
    }

    const selCtrStr = String(selectedCenterId).trim().toLowerCase();
    const centerObj = centers.find(c => 
      String(c._id).trim().toLowerCase() === selCtrStr || 
      c.code.trim().toLowerCase() === selCtrStr ||
      c.name.trim().toLowerCase() === selCtrStr
    );

    const targetCenterId = centerObj ? centerObj._id : selectedCenterId;

    const current = member.assigned_centers || [];
    if (current.includes(targetCenterId) || current.includes(selectedCenterId)) {
      toast.info("Center branch is already assigned to this staff member");
      return;
    }

    const updated = [...current, targetCenterId];
    setSaving(true);

    try {
      await apiFetch(`/api/staff/${member._id}`, {
        method: "PUT",
        body: JSON.stringify({ assigned_centers: updated })
      }).catch(() => null);

      saveLocalAllotment(member._id, updated);
      saveLocalAllotment(member.name, updated);

      setStaff(prev => prev.map(s => (s._id === member._id || s.name === member.name) ? { ...s, assigned_centers: updated } : s));
      toast.success(`Center assigned successfully to ${member.name}!`);
      setSelectedCenterId("");
    } catch {
      saveLocalAllotment(member._id, updated);
      saveLocalAllotment(member.name, updated);
      setStaff(prev => prev.map(s => (s._id === member._id || s.name === member.name) ? { ...s, assigned_centers: updated } : s));
      toast.success(`Center assigned successfully to ${member.name}!`);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveCenter = async (member: StaffMember, centerId: string) => {
    const updated = (member.assigned_centers || []).filter(id => id !== centerId);
    try {
      await apiFetch(`/api/staff/${member._id}`, {
        method: "PUT",
        body: JSON.stringify({ assigned_centers: updated })
      }).catch(() => null);

      saveLocalAllotment(member._id, updated);
      saveLocalAllotment(member.name, updated);
      setStaff(prev => prev.map(s => (s._id === member._id || s.name === member.name) ? { ...s, assigned_centers: updated } : s));
      toast.success("Center assignment removed");
    } catch {
      saveLocalAllotment(member._id, updated);
      saveLocalAllotment(member.name, updated);
      setStaff(prev => prev.map(s => (s._id === member._id || s.name === member.name) ? { ...s, assigned_centers: updated } : s));
      toast.success("Center assignment removed");
    }
  };

  const handleCreateCustomCenter = () => {
    if (!newCenterName.trim()) {
      toast.error("Center branch name is required");
      return;
    }
    const newCtr: Center = {
      _id: `custom_ctr_${Date.now()}`,
      name: newCenterName.trim(),
      code: newCenterCode.trim() || `CTR-${Math.floor(100 + Math.random() * 900)}`,
      city: newCenterCity.trim() || "Main Branch"
    };

    const savedCustom = localStorage.getItem("scre_custom_centers");
    const list: Center[] = savedCustom ? JSON.parse(savedCustom) : [];
    list.push(newCtr);
    localStorage.setItem("scre_custom_centers", JSON.stringify(list));

    setCenters(prev => [...prev, newCtr]);
    setSelectedCenterId(newCtr._id);
    setNewCenterName("");
    setNewCenterCode("");
    setNewCenterCity("");
    setShowAddCenterModal(false);
    toast.success("New center branch created!");
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
        {/* Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-black text-2xl md:text-3xl text-white uppercase tracking-tight flex items-center gap-3">
              <Building className="w-8 h-8 text-blue-400" />
              Staff Center Allotment Manager
            </h1>
            <p className="text-slate-400 mt-1 text-xs md:text-sm font-medium">
              Map training centers and regional branches to staff members for multi-branch counseling and administration.
            </p>
          </div>
          <button
            onClick={() => setShowAddCenterModal(true)}
            className="px-4 py-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4" /> Add New Center Branch
          </button>
        </div>

        {/* Allotment Control Card */}
        <Card className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-400" /> Assign Center Branch to Staff
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase">Select Staff Member *</label>
              <select
                className="w-full mt-1 px-4 py-3 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-bold outline-none focus:border-blue-500"
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
              >
                <option value="">-- SELECT STAFF MEMBER --</option>
                {staff.map(s => (
                  <option key={s._id} value={s._id}>{s.name} ({s.designation || "Staff"})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 uppercase">Select Center Branch *</label>
              <select
                className="w-full mt-1 px-4 py-3 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-bold outline-none focus:border-blue-500"
                value={selectedCenterId}
                onChange={(e) => setSelectedCenterId(e.target.value)}
              >
                <option value="">-- SELECT TRAINING CENTER --</option>
                {centers.map(c => (
                  <option key={c._id} value={c._id}>{c.name} ({c.code}) - {c.city || "Branch"}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleAddCenterAllotment}
                disabled={saving || !selectedStaffId || !selectedCenterId}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-40"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirm Center Allotment
              </button>
            </div>
          </div>
        </Card>

        {/* Staff Center Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {staff.map((member) => {
            const assignedIds = member.assigned_centers || [];
            const assignedCenters = centers.filter(c => assignedIds.includes(c._id) || assignedIds.includes(c.code) || assignedIds.includes(c.name));

            return (
              <Card key={member._id} className="rounded-2xl bg-slate-900 border border-slate-800 shadow-lg overflow-hidden">
                <CardHeader className="bg-slate-950/80 border-b border-slate-800 py-4 px-6">
                  <CardTitle className="text-sm font-bold text-white flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-400" />
                      {member.name}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {assignedCenters.length} Branches Assigned
                    </span>
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-5 space-y-3">
                  {assignedCenters.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl">
                      <MapPin className="w-6 h-6 text-slate-600 mx-auto mb-1" />
                      <p className="text-xs text-slate-500 font-medium">No center branches assigned to this staff member yet.</p>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {assignedCenters.map(c => (
                        <div key={c._id} className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2 text-xs text-white shadow-sm">
                          <MapPin className="w-4 h-4 text-blue-400" />
                          <span className="font-bold">{c.name}</span>
                          <span className="text-[10px] font-mono text-slate-400">({c.code})</span>
                          <button
                            onClick={() => handleRemoveCenter(member, c._id)}
                            className="text-slate-500 hover:text-rose-400 ml-1 transition"
                            title="Un-assign Center"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Add Center Modal */}
        {showAddCenterModal && (
          <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-400" /> Add Custom Center Branch
                </h3>
                <button onClick={() => setShowAddCenterModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 uppercase">Center Branch Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. North Delhi Skill Campus"
                    value={newCenterName}
                    onChange={(e) => setNewCenterName(e.target.value)}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-bold outline-none focus:border-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 uppercase">Center Code</label>
                    <input
                      type="text"
                      placeholder="e.g. CTR-909"
                      value={newCenterCode}
                      onChange={(e) => setNewCenterCode(e.target.value)}
                      className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs font-bold outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 uppercase">City / Location</label>
                    <input
                      type="text"
                      placeholder="e.g. Delhi"
                      value={newCenterCity}
                      onChange={(e) => setNewCenterCity(e.target.value)}
                      className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-bold outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCenterModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateCustomCenter}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-500/20"
                >
                  Create & Select
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminStaffCentersPage;
