import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, UserPlus, Users, Edit, Trash2, Briefcase, Loader2, CheckCircle2, ShieldAlert, Award, FileText, Phone, Mail, GraduationCap, MapPin, Eye, X, Building2, Calendar } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/api";

interface Intern {
  _id: any;
  username: string;
  fullName?: string;
  course?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  active: boolean;
  internshipDomain?: string;
  internshipMode?: string;
  college?: string;
  highestQualification?: string;
  enrollment_number?: string;
  serial_number?: string;
  registration_date?: string;
}

const toId = (v: unknown): string => {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "$oid" in (v as object)) return (v as { $oid: string }).$oid;
  if (v && typeof v === "object" && "_id" in (v as object)) return toId((v as any)._id);
  if (v && typeof v === "object") return JSON.stringify(v);
  return String(v ?? "");
};

const InternListPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [interns, setInterns] = useState<Intern[]>([]);
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState("all");
  const [selectedIntern, setSelectedIntern] = useState<Intern | null>(null);
  const location = useLocation();

  const [user] = useState<{ username: string; role: string } | null>(() => {
    const storedUser = sessionStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const currentUserRole = user?.role?.toLowerCase().replace(" ", "") || "";
  const canAddIntern = ["center", "admin", "superadmin"].includes(currentUserRole);

  useEffect(() => {
    fetchInterns();
  }, [location.pathname]);

  const fetchInterns = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/interns");
      const rawData = await res.json();
      if (res.ok) {
        const mapped = rawData.map((s: any) => ({
          ...s,
          _id: toId(s._id || s.id),
          fullName: s.fullName || s.full_name,
          enrollment_number: s.enrollment_number || s.enrollmentNumber,
          serial_number: s.serial_number || s.serialNumber,
          internshipDomain: s.internshipDomain || s.course || "Software Engineering",
          internshipMode: s.internshipMode || "Remote",
        }));
        setInterns(mapped);
      } else {
        toast.error("Failed to load interns");
      }
    } catch {
      toast.error("Failed to load interns");
    } finally {
      setLoading(false);
    }
  };

  const deleteIntern = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this intern?")) return;
    try {
      const res = await apiFetch(`/api/interns/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Intern deleted successfully");
        fetchInterns();
      } else {
        toast.error("Failed to delete intern");
      }
    } catch {
      toast.error("An error occurred during deletion");
    }
  };

  const filtered = interns.filter((s) => {
    const matchesSearch =
      (s.fullName || "").toLowerCase().includes(search.toLowerCase()) ||
      s.username.toLowerCase().includes(search.toLowerCase()) ||
      (s.college || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.internshipDomain || "").toLowerCase().includes(search.toLowerCase());

    const matchesDomain =
      domainFilter === "all" ||
      (s.internshipDomain || "").toLowerCase().includes(domainFilter.toLowerCase());

    return matchesSearch && matchesDomain;
  });

  // KPI Computations
  const totalCount = interns.length;
  const activeCount = interns.filter((i) => i.active).length;
  const remoteCount = interns.filter((i) => (i.internshipMode || "").toLowerCase().includes("remote")).length;
  const uniqueColleges = new Set(interns.map((i) => i.college).filter(Boolean)).size;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 pb-12">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl border border-indigo-500/20 shadow-xl">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-1">
              <Briefcase className="w-4 h-4" /> Active Intern Directory
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Internship Operations & Records
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Manage registered interns, track progress, review placements, and grant project access.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {canAddIntern && (
              <Link
                to="/dashboard/interns/add"
                className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center gap-2 transition-all transform hover:-translate-y-0.5"
              >
                <UserPlus className="w-4 h-4" /> Register New Intern
              </Link>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-lg backdrop-blur-xl relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Interns</p>
                <h3 className="text-2xl font-extrabold text-white mt-2">{totalCount}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="text-[11px] text-cyan-400 mt-3 font-semibold">Live registered interns</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-lg backdrop-blur-xl relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Accounts</p>
                <h3 className="text-2xl font-extrabold text-emerald-400 mt-2">{activeCount}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <div className="text-[11px] text-emerald-400 mt-3 font-semibold">Active & working</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-lg backdrop-blur-xl relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Remote Mode</p>
                <h3 className="text-2xl font-extrabold text-indigo-400 mt-2">{remoteCount}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Briefcase className="w-5 h-5" />
              </div>
            </div>
            <div className="text-[11px] text-indigo-400 mt-3 font-semibold">Online internship track</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-lg backdrop-blur-xl relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Partner Colleges</p>
                <h3 className="text-2xl font-extrabold text-amber-400 mt-2">{uniqueColleges}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
            <div className="text-[11px] text-amber-400 mt-3 font-semibold">Institution network</div>
          </div>
        </div>

        {/* Directory Table Card */}
        <Card className="rounded-2xl border border-slate-800 bg-slate-950/80 backdrop-blur-xl shadow-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-800/80 py-4 px-6 bg-slate-900/50">
            <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-200 flex items-center gap-2 uppercase tracking-wider">
                <Users className="w-4 h-4 text-cyan-400" /> Intern Roster
              </CardTitle>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={domainFilter}
                  onChange={(e) => setDomainFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-900 border border-slate-700 text-slate-200 rounded-xl text-xs font-medium focus:border-cyan-500 outline-none"
                >
                  <option value="all">All Domains</option>
                  <option value="web">Web Development</option>
                  <option value="python">AI / Python</option>
                  <option value="cloud">Cloud / DevOps</option>
                  <option value="cyber">Cyber Security</option>
                  <option value="data">Data Science</option>
                </select>

                <div className="relative min-w-[240px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    placeholder="Search by name, email, college..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 text-slate-200 rounded-xl text-xs font-medium focus:border-cyan-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="p-16 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                <span className="text-xs text-slate-400 font-medium">Loading Intern Directory...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-16 text-center text-slate-400 text-xs">
                No intern records match your search criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-slate-300">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/40 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                      <th className="px-5 py-3.5">Intern Name & Credentials</th>
                      <th className="px-4 py-3.5">Domain</th>
                      <th className="px-4 py-3.5">College & Qualification</th>
                      <th className="px-4 py-3.5">Mode</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs">
                    {filtered.map((s) => {
                      const sid = toId(s._id);
                      return (
                        <tr key={sid} className="hover:bg-slate-900/40 transition-colors">
                          <td className="px-5 py-4">
                            <div className="font-bold text-white text-sm">{s.fullName || s.username}</div>
                            <div className="text-cyan-400/90 text-[11px]">{s.username || s.email}</div>
                            {s.enrollment_number && (
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                Enrollment: <span className="text-slate-200 font-bold">{s.enrollment_number}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <span className="inline-block px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-semibold rounded-lg text-[11px]">
                              {s.internshipDomain}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="font-medium text-slate-200">{s.college || "College Not Specified"}</div>
                            <div className="text-slate-400 text-[11px]">{s.highestQualification || "Qualification N/A"}</div>
                          </td>
                          <td className="px-4 py-4">
                            <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded text-[10px] font-bold text-slate-300 uppercase">
                              {s.internshipMode}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                                s.active
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                  : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                              }`}
                            >
                              {s.active ? "Active" : "Disabled"}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* View Profile Button */}
                              <button
                                onClick={() => setSelectedIntern(s)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg transition-colors"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {/* Edit Intern */}
                              <Link
                                to={`/dashboard/interns/edit/${sid}`}
                                className="p-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg transition-colors"
                                title="Edit Intern"
                              >
                                <Edit className="w-4 h-4" />
                              </Link>

                              {/* Delete Intern */}
                              <button
                                onClick={() => deleteIntern(sid)}
                                className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg transition-colors"
                                title="Delete Intern"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* INTERN DETAILS MODAL */}
      {selectedIntern && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 relative text-slate-200 shadow-2xl">
            <button
              onClick={() => setSelectedIntern(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg bg-slate-900 border border-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <GraduationCap className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{selectedIntern.fullName || selectedIntern.username}</h3>
                <span className="text-xs text-cyan-400 font-medium">Intern Account Profile</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-slate-900/60 p-4 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-400 block font-semibold">Enrollment Number:</span>
                <span className="text-white text-sm font-bold font-mono">{selectedIntern.enrollment_number || "INT-2026-REG"}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Serial Number:</span>
                <span className="text-white text-sm font-bold font-mono">{selectedIntern.serial_number || "SR-2026-REG"}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Email Login:</span>
                <span className="text-cyan-300 font-bold">{selectedIntern.username}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Contact Phone:</span>
                <span className="text-slate-200 font-bold">{selectedIntern.phone || "N/A"}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Internship Domain:</span>
                <span className="text-emerald-400 font-bold">{selectedIntern.internshipDomain}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Working Mode:</span>
                <span className="text-slate-200">{selectedIntern.internshipMode}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">College / University:</span>
                <span className="text-slate-200">{selectedIntern.college || "N/A"}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Highest Qualification:</span>
                <span className="text-slate-200">{selectedIntern.highestQualification || "N/A"}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setSelectedIntern(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default InternListPage;
