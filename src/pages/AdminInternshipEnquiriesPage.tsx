import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search, Eye, Trash2, Download, Briefcase, FileText, CheckCircle2, UserCheck, Calendar, GraduationCap, Building2, MapPin, X, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

interface EnquiryItem {
  id: string;
  name: string;
  phone: string;
  email?: string;
  course: string;
  center_id?: string;
  center_name?: string;
  message?: string;
  college?: string;
  status: string;
  assigned_to?: string;
  next_follow_up_at?: string;
  qualification?: string;
  branch?: string;
  passing_year?: string;
  internship_domain?: string;
  internship_mode?: string;
  duration?: string;
  resume_url?: string;
  gender?: string;
  dob?: string;
  created_at: string;
  updated_at: string;
}

const AdminInternshipEnquiriesPage = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<EnquiryItem[]>([]);
  const [status, setStatus] = useState("all");
  const [due, setDue] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);

  // Selected item for Detail Modal
  const [selectedEnquiry, setSelectedEnquiry] = useState<EnquiryItem | null>(null);

  // Allotment Modal State
  const [allotModalEnquiry, setAllotModalEnquiry] = useState<EnquiryItem | null>(null);
  const [allotLoading, setAllotLoading] = useState(false);
  const [allotForm, setAllotForm] = useState({
    password: "Intern@2026Password",
    enrollmentNumber: "",
    serialNumber: "",
    category: "General",
    session: "2026-Summer",
  });

  const user = JSON.parse(sessionStorage.getItem("user") || "{}");
  const isAdmin = user.role?.toLowerCase() === "admin" || user.role?.toLowerCase() === "superadmin";

  useEffect(() => {
    fetchData();
  }, [status, due, search, page, limit]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("token");
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (search.trim()) params.set("search", search.trim());
      if (due !== "all") params.set("due", due);
      params.set("enquiry_type", "internship");
      params.set("page", String(page));
      params.set("limit", String(limit));
      const res = await fetch(`/api/admin/enquiries?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token || ""}` },
      });
      const data = await res.json();
      if (res.ok) {
        setItems(data.items || []);
        setTotal(data.total || 0);
      } else {
        toast.error(data.message || "Failed to load internship enquiries");
      }
    } catch {
      toast.error("Failed to load internship enquiries");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, next: string) => {
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`/api/admin/enquiries/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Status updated to ${next.toUpperCase()}`);
        fetchData();
      } else {
        toast.error(data.message || "Update failed");
      }
    } catch {
      toast.error("Update failed");
    }
  };

  const deleteEnquiry = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this enquiry?")) return;
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`/api/admin/enquiries/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token || ""}` },
      });
      if (res.ok) {
        toast.success("Enquiry deleted successfully");
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.message || "Delete failed");
      }
    } catch {
      toast.error("Delete failed");
    }
  };

  const openAllotModal = (item: EnquiryItem) => {
    const timestamp = Date.now().toString().slice(-5);
    setAllotForm({
      password: "Intern@2026Password",
      enrollmentNumber: `INT-2026-${timestamp}`,
      serialNumber: `SR-${timestamp}`,
      category: "General",
      session: "2026-Summer",
    });
    setAllotModalEnquiry(item);
  };

  const handleConfirmAllotment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allotModalEnquiry) return;
    setAllotLoading(true);

    try {
      const token = sessionStorage.getItem("token");
      const payload = {
        fullName: allotModalEnquiry.name,
        email: allotModalEnquiry.email || `intern_${Date.now()}@scre.in`,
        phone: allotModalEnquiry.phone,
        password: allotForm.password,
        course: allotModalEnquiry.course || allotModalEnquiry.internship_domain || "Software Development Internship",
        internshipDomain: allotModalEnquiry.internship_domain || allotModalEnquiry.course || "Software Development",
        internshipMode: allotModalEnquiry.internship_mode || "Remote",
        highestQualification: allotModalEnquiry.qualification || "Graduate",
        college: allotModalEnquiry.college || "",
        enrollmentNumber: allotForm.enrollmentNumber,
        serialNumber: allotForm.serialNumber,
        gender: allotModalEnquiry.gender,
        dob: allotModalEnquiry.dob,
        category: allotForm.category,
      };

      const res = await fetch("/api/interns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || ""}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Intern ${allotModalEnquiry.name} successfully registered & allotted!`);
        // Automatically set enquiry status to converted
        await updateStatus(allotModalEnquiry.id, "converted");
        setAllotModalEnquiry(null);
      } else {
        toast.error(data.message || "Failed to allot intern");
      }
    } catch {
      toast.error("An error occurred during allotment");
    } finally {
      setAllotLoading(false);
    }
  };

  const exportCSV = async () => {
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch("/api/admin/enquiries/export", {
        headers: { Authorization: `Bearer ${token || ""}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `internship-enquiries_${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        toast.error("Export failed");
      }
    } catch {
      toast.error("Export failed");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const getStatusBadge = (st: string) => {
    switch (st.toLowerCase()) {
      case "converted":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "contacted":
        return "bg-blue-500/10 text-blue-400 border-blue-500/30";
      case "followup":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "lost":
        return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      default:
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 pb-12">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl border border-indigo-500/20 shadow-xl">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-1">
              <Briefcase className="w-4 h-4" /> Internship Management Portal
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Internship Enquiries & Lead Allotment
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Review incoming student applications, inspect profiles, and directly allot official Intern credentials.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={exportCSV}
              className="px-4 py-2.5 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-cyan-300 font-semibold text-xs rounded-xl flex items-center gap-2 transition-all shadow-lg"
            >
              <Download className="w-4 h-4" /> Export CSV Data
            </button>
          </div>
        </div>

        {/* Filter Controls Card */}
        <Card className="rounded-2xl border border-slate-800 bg-slate-950/80 backdrop-blur-xl shadow-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-800/80 py-4 px-6 bg-slate-900/50">
            <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
              <CardTitle className="text-sm font-bold text-slate-200 flex items-center gap-2 uppercase tracking-wider">
                <Search className="w-4 h-4 text-cyan-400" /> Filter & Search Applications
              </CardTitle>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="px-3 py-2 bg-slate-900 border border-slate-700 text-slate-200 rounded-xl text-xs font-medium focus:border-cyan-500 outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="followup">Follow-up</option>
                  <option value="converted">Converted (Allotted)</option>
                  <option value="lost">Lost</option>
                </select>

                <select
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  className="px-3 py-2 bg-slate-900 border border-slate-700 text-slate-200 rounded-xl text-xs font-medium focus:border-cyan-500 outline-none"
                >
                  <option value="all">All Schedules</option>
                  <option value="today">Due Today</option>
                  <option value="overdue">Overdue</option>
                  <option value="upcoming">Upcoming</option>
                </select>

                <div className="relative min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search candidate, domain, college..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 text-slate-200 rounded-xl text-xs font-medium focus:border-cyan-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-16 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                <span className="text-xs text-slate-400 font-medium">Fetching Internship Applications...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-slate-300">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/40 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                      <th className="px-5 py-3.5">Candidate Info</th>
                      <th className="px-4 py-3.5">Domain / Course</th>
                      <th className="px-4 py-3.5">Qualification & College</th>
                      <th className="px-4 py-3.5">Mode & Duration</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs">
                    {items.map((e) => {
                      const domainName = e.internship_domain || e.course || "General Internship";
                      const modeName = e.internship_mode || "Remote";
                      const durationStr = e.duration || "3 Months";
                      const isConverted = e.status.toLowerCase() === "converted";

                      return (
                        <tr key={e.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="px-5 py-4">
                            <div className="font-bold text-white text-sm">{e.name}</div>
                            <div className="text-slate-400 text-[11px] mt-0.5">{e.phone}</div>
                            {e.email && <div className="text-cyan-400/90 text-[11px]">{e.email}</div>}
                          </td>
                          <td className="px-4 py-4">
                            <div className="inline-block px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-semibold rounded-lg text-[11px]">
                              {domainName}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="font-medium text-slate-200">
                              {e.qualification || "Degree N/A"} {e.branch ? `(${e.branch})` : ""}
                            </div>
                            <div className="text-slate-400 text-[11px] truncate max-w-[180px]">
                              {e.college || "College not specified"}
                            </div>
                            {e.passing_year && <div className="text-slate-500 text-[10px]">Passout: {e.passing_year}</div>}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1.5 text-slate-300">
                              <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] uppercase font-bold">
                                {modeName}
                              </span>
                              <span className="text-slate-400 text-[11px]">{durationStr}</span>
                            </div>
                            {e.resume_url && (
                              <a
                                href={e.resume_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:underline mt-1 font-medium"
                              >
                                <FileText className="w-3 h-3" /> View Resume
                              </a>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${getStatusBadge(e.status)}`}>
                              {e.status}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* View Details Modal Button */}
                              <button
                                onClick={() => setSelectedEnquiry(e)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg transition-colors"
                                title="View Full Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {/* Allot Intern Button */}
                              {!isConverted ? (
                                <button
                                  onClick={() => openAllotModal(e)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-lg shadow-md flex items-center gap-1 transition-all"
                                  title="Allot Official Intern Credential"
                                >
                                  <UserCheck className="w-3.5 h-3.5" /> Allot Intern
                                </button>
                              ) : (
                                <span className="text-[10px] text-emerald-400 font-bold px-2 py-1 bg-emerald-500/10 rounded border border-emerald-500/20">
                                  ✓ Registered
                                </span>
                              )}

                              {/* Quick Status Dropdown */}
                              <select
                                value={e.status}
                                onChange={(evt) => updateStatus(e.id, evt.target.value)}
                                className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-2 py-1 text-[11px] focus:border-cyan-500 outline-none"
                              >
                                <option value="new">New</option>
                                <option value="contacted">Contacted</option>
                                <option value="followup">Followup</option>
                                <option value="converted">Converted</option>
                                <option value="lost">Lost</option>
                              </select>

                              {/* Delete Button */}
                              <button
                                onClick={() => deleteEnquiry(e.id)}
                                className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg transition-colors"
                                title="Delete Enquiry"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {items.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center text-slate-400 text-xs">
                          No internship applications found for this filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div>Showing page {page} of {totalPages} (Total {total} enquiries)</div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 rounded-lg disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 rounded-lg disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* DETAILED VIEW MODAL */}
      {selectedEnquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 relative text-slate-200 shadow-2xl">
            <button
              onClick={() => setSelectedEnquiry(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg bg-slate-900 border border-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{selectedEnquiry.name}</h3>
                <span className="text-xs text-cyan-400 font-medium">Internship Candidate Profile</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-slate-900/60 p-4 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-400 block font-semibold">Phone Number:</span>
                <span className="text-white text-sm font-bold">{selectedEnquiry.phone}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Email Address:</span>
                <span className="text-white text-sm font-bold">{selectedEnquiry.email || "N/A"}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Qualification & Branch:</span>
                <span className="text-slate-200">{selectedEnquiry.qualification || "N/A"} ({selectedEnquiry.branch || "N/A"})</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Passing Year:</span>
                <span className="text-slate-200">{selectedEnquiry.passing_year || "N/A"}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">College / University:</span>
                <span className="text-slate-200">{selectedEnquiry.college || "N/A"}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Gender / DOB:</span>
                <span className="text-slate-200">{selectedEnquiry.gender || "N/A"} | {selectedEnquiry.dob || "N/A"}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Requested Domain:</span>
                <span className="text-cyan-300 font-bold">{selectedEnquiry.internship_domain || selectedEnquiry.course}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Mode & Duration:</span>
                <span className="text-slate-200">{selectedEnquiry.internship_mode || "Remote"} ({selectedEnquiry.duration || "3 Months"})</span>
              </div>
            </div>

            {selectedEnquiry.message && (
              <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 text-xs">
                <span className="text-slate-400 font-semibold block mb-1">Candidate Message / Statement:</span>
                <p className="text-slate-300 leading-relaxed italic">"{selectedEnquiry.message}"</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              {selectedEnquiry.resume_url ? (
                <a
                  href={selectedEnquiry.resume_url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-cyan-300 font-bold text-xs rounded-xl flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" /> Download / View Resume <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              ) : (
                <span className="text-xs text-slate-500 italic">No resume link uploaded</span>
              )}

              <button
                onClick={() => setSelectedEnquiry(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ALLOT INTERN MODAL */}
      {allotModalEnquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-950 border border-emerald-500/30 rounded-2xl max-w-xl w-full p-6 space-y-6 relative text-slate-200 shadow-2xl">
            <button
              onClick={() => setAllotModalEnquiry(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg bg-slate-900 border border-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Allot Intern Account</h3>
                <p className="text-xs text-slate-400">Registering candidate: <span className="text-emerald-400 font-bold">{allotModalEnquiry.name}</span></p>
              </div>
            </div>

            <form onSubmit={handleConfirmAllotment} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Enrollment Number</label>
                  <input
                    required
                    value={allotForm.enrollmentNumber}
                    onChange={(e) => setAllotForm({ ...allotForm, enrollmentNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 focus:border-emerald-500 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Serial Number</label>
                  <input
                    required
                    value={allotForm.serialNumber}
                    onChange={(e) => setAllotForm({ ...allotForm, serialNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 focus:border-emerald-500 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Default Password</label>
                  <input
                    required
                    type="text"
                    value={allotForm.password}
                    onChange={(e) => setAllotForm({ ...allotForm, password: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 focus:border-emerald-500 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Session / Batch</label>
                  <input
                    required
                    value={allotForm.session}
                    onChange={(e) => setAllotForm({ ...allotForm, session: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-[11px] leading-relaxed">
                This will create an active <strong>Intern</strong> user account in MongoDB for <strong>{allotModalEnquiry.email || allotModalEnquiry.name}</strong>, granting them access to the Intern Dashboard and live projects.
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAllotModalEnquiry(null)}
                  className="px-4 py-2 bg-slate-900 border border-slate-700 text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={allotLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg flex items-center gap-2"
                >
                  {allotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Confirm Allotment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default AdminInternshipEnquiriesPage;
