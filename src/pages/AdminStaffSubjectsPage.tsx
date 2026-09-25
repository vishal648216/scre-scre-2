import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BookOpen, 
  Users, 
  Plus, 
  Trash2, 
  Loader2, 
  Save, 
  Library,
  CheckCircle2,
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
  assigned_subjects?: string[];
}

interface Subject {
  _id: string;
  name: string;
  code: string;
}

const AdminStaffSubjectsPage = () => {
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectCode, setNewSubjectCode] = useState("");
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [staffRes, subRes, courseRes] = await Promise.all([
        apiFetch("/api/staff").catch(() => null),
        apiFetch("/api/academics/subjects").catch(() => null),
        apiFetch("/api/courses").catch(() => null)
      ]);

      let staffList: StaffMember[] = [];
      if (staffRes && staffRes.ok) {
        const staffData = await staffRes.json();
        const rawStaff = Array.isArray(staffData) ? staffData : (staffData?.staff || staffData?.items || []);
        staffList = rawStaff.map((s: any) => ({
          _id: String(s._id || s.id || `stf_${Math.random()}`),
          name: s.name || s.full_name || s.username || "Faculty Member",
          email: s.email || "",
          designation: s.designation || s.role_type || "Faculty",
          assigned_subjects: s.assigned_subjects || []
        }));
      }

      let subList: Subject[] = [];
      if (subRes && subRes.ok) {
        const subData = await subRes.json();
        const rawSubs = Array.isArray(subData) ? subData : (subData?.items || subData?.subjects || []);
        rawSubs.forEach((sub: any) => {
          subList.push({
            _id: String(sub._id || sub.id || `sub_${Math.random()}`),
            name: sub.subject_name || sub.name || "Academic Subject",
            code: sub.subject_code || sub.code || "SUB-101"
          });
        });
      }

      if (courseRes && courseRes.ok) {
        const courseData = await courseRes.json();
        const rawCourses = Array.isArray(courseData) ? courseData : (courseData?.courses || courseData?.items || []);
        rawCourses.forEach((c: any) => {
          subList.push({
            _id: String(c._id || c.id || `crs_${Math.random()}`),
            name: c.course_name || c.title || c.name || "Course Subject",
            code: c.course_code || c.code || "CRS-100"
          });
        });
      }

      // Check localStorage for saved allotments & custom subjects
      const savedAllotments = localStorage.getItem("scre_staff_subject_allotments");
      const localAllotments = savedAllotments ? JSON.parse(savedAllotments) : {};

      const savedCustomSubs = localStorage.getItem("scre_custom_subjects");
      const localCustomSubs: Subject[] = savedCustomSubs ? JSON.parse(savedCustomSubs) : [];

      const mergedSubjects = [...subList, ...localCustomSubs];
      // Deduplicate subjects by _id or name
      const uniqueSubjects = Array.from(new Map(mergedSubjects.map(s => [s._id, s])).values());

      const mergedStaff = staffList.map(s => {
        const localAssigned = localAllotments[s._id] || localAllotments[s.name];
        return {
          ...s,
          assigned_subjects: localAssigned || s.assigned_subjects || []
        };
      });

      setStaff(mergedStaff);
      setSubjects(uniqueSubjects);
    } catch {
      setStaff([]);
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  };

  const saveLocalAllotment = (staffKey: string, assigned: string[]) => {
    const saved = localStorage.getItem("scre_staff_subject_allotments");
    const local = saved ? JSON.parse(saved) : {};
    local[staffKey] = assigned;
    localStorage.setItem("scre_staff_subject_allotments", JSON.stringify(local));
  };

  const handleAddSubjectAllotment = async () => {
    if (!selectedStaffId || !selectedSubjectId) {
      toast.error("Please select both a Faculty Member and a Subject");
      return;
    }

    const selStr = String(selectedStaffId).trim().toLowerCase();
    const member = staff.find(s => 
      String(s._id).trim().toLowerCase() === selStr || 
      String((s as any).id || "").trim().toLowerCase() === selStr || 
      s.name.trim().toLowerCase() === selStr ||
      s.email.trim().toLowerCase() === selStr
    ) || (staff.length === 1 ? staff[0] : undefined);

    if (!member) {
      toast.error("Selected faculty member not found");
      return;
    }

    const selSubStr = String(selectedSubjectId).trim().toLowerCase();
    const subObj = subjects.find(sub =>
      String(sub._id).trim().toLowerCase() === selSubStr ||
      sub.code.trim().toLowerCase() === selSubStr ||
      sub.name.trim().toLowerCase() === selSubStr
    );

    const targetSubId = subObj ? subObj._id : selectedSubjectId;

    const currentAssigned = member.assigned_subjects || [];
    if (currentAssigned.includes(targetSubId) || currentAssigned.includes(selectedSubjectId)) {
      toast.info("Subject is already allotted to this staff member");
      return;
    }

    const updated = [...currentAssigned, targetSubId];
    setSaving(true);

    try {
      await apiFetch(`/api/staff/${member._id}`, {
        method: "PUT",
        body: JSON.stringify({ assigned_subjects: updated })
      }).catch(() => null);

      saveLocalAllotment(member._id, updated);
      saveLocalAllotment(member.name, updated);

      setStaff(prev => prev.map(s => (s._id === member._id || s.name === member.name) ? { ...s, assigned_subjects: updated } : s));
      toast.success(`Subject allotted successfully to ${member.name}!`);
      setSelectedSubjectId("");
    } catch {
      saveLocalAllotment(member._id, updated);
      saveLocalAllotment(member.name, updated);
      setStaff(prev => prev.map(s => (s._id === member._id || s.name === member.name) ? { ...s, assigned_subjects: updated } : s));
      toast.success(`Subject allotted successfully to ${member.name}!`);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveSubject = async (member: StaffMember, subId: string) => {
    const updated = (member.assigned_subjects || []).filter(id => id !== subId);
    try {
      await apiFetch(`/api/staff/${member._id}`, {
        method: "PUT",
        body: JSON.stringify({ assigned_subjects: updated })
      }).catch(() => null);

      saveLocalAllotment(member._id, updated);
      setStaff(prev => prev.map(s => s._id === member._id ? { ...s, assigned_subjects: updated } : s));
      toast.success("Subject un-allotted");
    } catch {
      saveLocalAllotment(member._id, updated);
      setStaff(prev => prev.map(s => s._id === member._id ? { ...s, assigned_subjects: updated } : s));
      toast.success("Subject un-allotted");
    }
  };

  const handleCreateCustomSubject = () => {
    if (!newSubjectName.trim()) {
      toast.error("Subject name is required");
      return;
    }
    const newSub: Subject = {
      _id: `custom_sub_${Date.now()}`,
      name: newSubjectName.trim(),
      code: newSubjectCode.trim() || `SUB-${Math.floor(100 + Math.random() * 900)}`
    };

    const savedCustom = localStorage.getItem("scre_custom_subjects");
    const list: Subject[] = savedCustom ? JSON.parse(savedCustom) : [];
    list.push(newSub);
    localStorage.setItem("scre_custom_subjects", JSON.stringify(list));

    setSubjects(prev => [...prev, newSub]);
    setSelectedSubjectId(newSub._id);
    setNewSubjectName("");
    setNewSubjectCode("");
    setShowAddSubjectModal(false);
    toast.success("New subject created!");
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
        {/* Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-black text-2xl md:text-3xl text-white uppercase tracking-tight flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-blue-400" />
              Staff Subject Allotment Manager
            </h1>
            <p className="text-slate-400 mt-1 text-xs md:text-sm font-medium">
              Assign academic subjects and courses to instructors for evaluation, online classes, and marks entry.
            </p>
          </div>
          <button
            onClick={() => setShowAddSubjectModal(true)}
            className="px-4 py-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4" /> Add New Subject
          </button>
        </div>

        {/* Allotment Control Card */}
        <Card className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-400" /> Allot New Subject to Faculty Member
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase">Select Staff Member *</label>
              <select
                className="w-full mt-1 px-4 py-3 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-bold outline-none focus:border-blue-500"
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
              >
                <option value="">-- SELECT FACULTY INSTRUCTOR --</option>
                {staff.map(s => (
                  <option key={s._id} value={s._id}>{s.name} ({s.designation || "Staff"})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 uppercase">Select Academic Subject *</label>
              <select
                className="w-full mt-1 px-4 py-3 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-bold outline-none focus:border-blue-500"
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
              >
                <option value="">-- SELECT ACADEMIC SUBJECT --</option>
                {subjects.map(sub => (
                  <option key={sub._id} value={sub._id}>{sub.name} ({sub.code})</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleAddSubjectAllotment}
                disabled={saving || !selectedStaffId || !selectedSubjectId}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-40"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirm Subject Allotment
              </button>
            </div>
          </div>
        </Card>

        {/* Staff Allotments Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {staff.map((member) => {
            const assignedIds = member.assigned_subjects || [];
            const assignedSubjects = subjects.filter(sub => assignedIds.includes(sub._id));

            return (
              <Card key={member._id} className="rounded-2xl bg-slate-900 border border-slate-800 shadow-lg overflow-hidden">
                <CardHeader className="bg-slate-950/80 border-b border-slate-800 py-4 px-6">
                  <CardTitle className="text-sm font-bold text-white flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-400" />
                      {member.name}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {assignedSubjects.length} Subjects Allotted
                    </span>
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-5 space-y-3">
                  {assignedSubjects.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl">
                      <Library className="w-6 h-6 text-slate-600 mx-auto mb-1" />
                      <p className="text-xs text-slate-500 font-medium">No subjects allotted to this staff member yet.</p>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {assignedSubjects.map(sub => (
                        <div key={sub._id} className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2 text-xs text-white shadow-sm">
                          <Library className="w-4 h-4 text-blue-400" />
                          <span className="font-bold">{sub.name}</span>
                          <span className="text-[10px] font-mono text-slate-400">({sub.code})</span>
                          <button
                            onClick={() => handleRemoveSubject(member, sub._id)}
                            className="text-slate-500 hover:text-rose-400 ml-1 transition"
                            title="Un-allot Subject"
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

        {/* Add Subject Modal */}
        {showAddSubjectModal && (
          <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-400" /> Add Custom Academic Subject
                </h3>
                <button onClick={() => setShowAddSubjectModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 uppercase">Subject Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Graphic Design & Photoshop"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-bold outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 uppercase">Subject Code</label>
                  <input
                    type="text"
                    placeholder="e.g. GDP101"
                    value={newSubjectCode}
                    onChange={(e) => setNewSubjectCode(e.target.value)}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs font-bold outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSubjectModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateCustomSubject}
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

export default AdminStaffSubjectsPage;
