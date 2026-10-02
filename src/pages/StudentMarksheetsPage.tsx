import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award as CertIcon, User, Search, Save, FileText, Stamp, Loader2, Layers, Download, Printer, CheckCircle, Clock, Trash2, GraduationCap, Building2, Sparkles, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

const StatusBadge = ({ status }: { status?: string }) => {
  const s = (status || "").toLowerCase();
  if (s === 'approved' || s === 'issued') {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 px-2.5 py-0.5">
        <CheckCircle className="w-3 h-3" />
        Issued
      </Badge>
    );
  }
  if (s === 'scheduled') {
    return (
      <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 px-2.5 py-0.5">
        <Clock className="w-3 h-3" />
        Scheduled
      </Badge>
    );
  }
  if (s === 'pending_approval') {
    return (
      <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 px-2.5 py-0.5">
        <Clock className="w-3 h-3" />
        Pending Approval
      </Badge>
    );
  }
  return null;
};

interface Template {
  _id: string | { $oid: string };
  template_name: string;
  template_type: string;
}

interface Student {
  _id: string | { $oid: string };
  username: string;
  fullName?: string;
  course?: string;
}

interface Certificate {
  _id: string;
  student_id: string | { $oid: string };
  center_id?: string | { $oid: string };
  center_name?: string;
  template_id?: string | { $oid: string };
  course: string;
  certificate_no: string;
  issued_on: string;
  status?: string;
  signature_url?: string;
  stamp_url?: string;
  pdf_url?: string;
}

const toId = (v: any): string => {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "$oid" in v) return v.$oid;
  return String(v || "");
};

const StudentMarksheetsPage = () => {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [templates, setTemplates] = useState<Template[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [certSearch, setCertSearch] = useState("");
  const [certTemplateFilter, setCertTemplateFilter] = useState<string>("all");
  const [certCourseFilter, setCertCourseFilter] = useState<string>("all");
  const [certStatusFilter, setCertStatusFilter] = useState<string>("issued_only");
  const [certCenterFilter, setCertCenterFilter] = useState<string>("all");
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);

  const studentIdStr = (s: Student) =>
    typeof s._id === "string" ? s._id : (s._id as { $oid: string })?.$oid ?? "";

  const user = JSON.parse(sessionStorage.getItem("user") || "{}");
  const role = (user.role || "").toLowerCase().replace(" ", "");
  const isCenter = role === "center";
  const isAdmin = role === "admin" || role === "superadmin";

  useEffect(() => {
    fetchData();
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await apiFetch("/api/templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(Array.isArray(data) ? data : []);
      }
    } catch {
      setTemplates([]);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sRes, cRes] = await Promise.all([
        apiFetch("/api/students"),
        apiFetch("/api/certificates"),
      ]);
      const sData = await sRes.json();
      const cData = await cRes.json();
      if (sRes.ok) setStudents(Array.isArray(sData) ? sData : []);
      if (cRes.ok) setCerts(Array.isArray(cData) ? cData : []);
    } catch (e) {
      console.error("Failed to load marksheets", e);
      toast.error("Failed to load marksheets");
    } finally {
      setLoading(false);
    }
  };

  const selectAllFiltered = () => {
    const allFilteredIds = filtered.map(s => studentIdStr(s));
    const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.has(id));

    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        allFilteredIds.forEach(id => next.delete(id));
      } else {
        allFilteredIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleDownload = async (certId: any, certNo: string) => {
    const id = toId(certId);
    setDownloading(id);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`/api/certificates/download/${id}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Marksheet_${certNo}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        toast.error("Failed to download marksheet. Try regenerating it.");
      }
    } catch {
      toast.error("Download failed");
    } finally {
      setDownloading(null);
    }
  };

  const handleDeleteCertificate = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this marksheet? This will also remove the PDF file from the server.")) return;
    try {
      const res = await apiFetch(`/api/certificates/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Marksheet deleted successfully");
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.message || "Failed to delete");
      }
    } catch {
      toast.error("An error occurred");
    }
  };

  const approveCertificate = async (id: string) => {
    setApproving(id);
    try {
      const res = await apiFetch(`/api/admin/certificates/${id}/approve`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Marksheet approved successfully");
        fetchData();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || "Failed to approve marksheet");
      }
    } catch {
      toast.error("Approval failed");
    } finally {
      setApproving(null);
    }
  };

  const filtered = students.filter(s =>
    (s.fullName || "").toLowerCase().includes(search.toLowerCase()) ||
    s.username.toLowerCase().includes(search.toLowerCase())
  );

  const studentById = useMemo(() => {
    const map = new Map<string, Student>();
    students.forEach((s) => map.set(studentIdStr(s), s));
    return map;
  }, [students]);

  const templateNameById = useMemo(() => {
    const map = new Map<string, string>();
    templates.forEach((t) => map.set(toId(t._id), t.template_name));
    return map;
  }, [templates]);

  const templateTypeById = useMemo(() => {
    const map = new Map<string, string>();
    templates.forEach((t) => map.set(toId(t._id), t.template_type?.toLowerCase() || ""));
    return map;
  }, [templates]);

  const filteredCertificates = useMemo(() => {
    const q = certSearch.trim().toLowerCase();

    return certs
      .filter((c) => {
        const certNo = (c.certificate_no || "").toLowerCase();
        const course = (c.course || "").toLowerCase();
        const student = studentById.get(toId(c.student_id))?.fullName || studentById.get(toId(c.student_id))?.username || "";
        const studentStr = (student || "").toLowerCase();

        const matchesSearch =
          !q ||
          certNo.includes(q) ||
          course.includes(q) ||
          studentStr.includes(q) ||
          (c.center_name || "").toLowerCase().includes(q);

        const matchesTemplate =
          certTemplateFilter === "all" || toId(c.template_id) === certTemplateFilter;

        const matchesCourse =
          certCourseFilter === "all" || (c.course || "").toLowerCase() === certCourseFilter.toLowerCase();

        const status = (c.status || "").toLowerCase();
        const matchesStatus =
          certStatusFilter === "all" ||
          (certStatusFilter === "issued_only" && (status === "approved" || status === "issued")) ||
          (certStatusFilter === "approved" && status === "approved") ||
          (certStatusFilter === "issued" && status === "issued") ||
          (certStatusFilter === "pending_approval" && status === "pending_approval") ||
          (certStatusFilter === "scheduled" && status === "scheduled");

        const matchesCenter =
          isCenter ||
          certCenterFilter === "all" ||
          toId(c.center_id) === certCenterFilter;

        const c_tpl = toId(c.template_id);
        const tplType = templateTypeById.get(c_tpl);

        let matchesType = false;

        if (tplType) {
          matchesType = tplType === "marksheet";
        } else {
          const filePath = ((c as any).file_path || (c as any).pdf_path || c.pdf_url || "").toLowerCase();
          const certNo = (c.certificate_no || "").toLowerCase();
          const isMarksheet = filePath.includes("/marksheets/") ||
                             filePath.includes("marksheets") ||
                             certNo.includes("marksheet");
          const isCertificate = filePath.includes("/certificates/") ||
                               filePath.includes("certificates");
          matchesType = isMarksheet || !isCertificate;
        }

        return matchesSearch && matchesTemplate && matchesCourse && matchesStatus && matchesCenter && matchesType;
      })
      .sort((a, b) => new Date(b.issued_on).getTime() - new Date(a.issued_on).getTime());
  }, [
    certSearch,
    certTemplateFilter,
    certCourseFilter,
    certStatusFilter,
    certCenterFilter,
    certs,
    studentById,
    templateTypeById,
    isCenter,
  ]);

  const availableCourses = useMemo(() => {
    const set = new Set<string>();
    certs.forEach((c) => {
      if (c.course) set.add(c.course);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [certs]);

  const availableCenters = useMemo(() => {
    const map = new Map<string, string>();
    certs.forEach((c) => {
      const cid = toId(c.center_id);
      const name = c.center_name || "";
      if (cid && name && !map.has(cid)) map.set(cid, name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [certs]);

  const handleDownloadBulk = async () => {
    const ids = filteredCertificates.map((c) => toId(c._id));
    if (ids.length === 0) return;
    setBulkDownloading(true);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`/api/certificates/download-bulk`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ certificate_ids: ids }),
      });
      if (!res.ok) {
        toast.error("Bulk download failed");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Marksheets_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      toast.error("Bulk download failed");
    } finally {
      setBulkDownloading(false);
    }
  };

  const issuedCount = certs.filter(c => (c.status || "").toLowerCase() === "approved" || (c.status || "").toLowerCase() === "issued").length;
  const pendingCount = certs.filter(c => (c.status || "").toLowerCase() === "pending_approval").length;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-heading font-extrabold text-2xl md:text-3xl text-zinc-100 uppercase tracking-tight">
                Student Marksheets
              </h1>
              <p className="text-zinc-400 text-xs font-medium">Issue, verify, and bulk-download student course marksheets in single PDF.</p>
            </div>
          </div>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-zinc-900/90 border border-zinc-800 p-5 rounded-2xl shadow-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Issued Marksheets</p>
              <h3 className="text-2xl font-black text-emerald-400 mt-1">{issuedCount}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800 p-5 rounded-2xl shadow-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Pending Verification</p>
              <h3 className="text-2xl font-black text-amber-400 mt-1">{pendingCount}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800 p-5 rounded-2xl shadow-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Total Courses</p>
              <h3 className="text-2xl font-black text-blue-400 mt-1">{availableCourses.length}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <GraduationCap className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800 p-5 rounded-2xl shadow-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Templates Available</p>
              <h3 className="text-2xl font-black text-purple-400 mt-1">{templates.length}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Layers className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Student Marksheets Main Card */}
        <Card className="rounded-2xl border-zinc-800 bg-zinc-900/90 shadow-xl overflow-hidden">
          <CardHeader className="bg-zinc-900/80 border-b border-zinc-800 p-5">
            <div className="flex items-start justify-between gap-4 flex-col md:flex-row md:items-center">
              <div>
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-zinc-100 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  Student Marksheets Registry ({filteredCertificates.length})
                </CardTitle>
                <p className="text-zinc-400 text-xs font-medium mt-1">
                  Filter marksheets and download them in a single combined PDF.
                </p>
              </div>

              <button
                onClick={handleDownloadBulk}
                disabled={bulkDownloading || filteredCertificates.length === 0}
                className="px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-black uppercase tracking-wider hover:bg-amber-400 disabled:opacity-40 flex items-center gap-2 shadow-lg shadow-amber-500/10"
              >
                {bulkDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Download All (Single PDF){" "}
                <span className="ml-1 text-slate-900/80">
                  ({filteredCertificates.length})
                </span>
              </button>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  Search
                </label>
                <input
                  value={certSearch}
                  onChange={(e) => setCertSearch(e.target.value)}
                  placeholder="Search by certificate no / course / student..."
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-xs font-bold text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  Template
                </label>
                <select
                  value={certTemplateFilter}
                  onChange={(e) => setCertTemplateFilter(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-xs font-bold text-zinc-200 focus:border-amber-500 outline-none uppercase"
                >
                  <option value="all">All Templates</option>
                  {templates.map((t) => (
                    <option key={toId(t._id)} value={toId(t._id)}>
                      {t.template_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  Course
                </label>
                <select
                  value={certCourseFilter}
                  onChange={(e) => setCertCourseFilter(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-xs font-bold text-zinc-200 focus:border-amber-500 outline-none uppercase"
                >
                  <option value="all">All Courses</option>
                  {availableCourses.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  Status
                </label>
                <select
                  value={certStatusFilter}
                  onChange={(e) => setCertStatusFilter(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-xs font-bold text-zinc-200 focus:border-amber-500 outline-none uppercase"
                >
                  <option value="issued_only">Issued (Approved/Issued)</option>
                  <option value="approved">Approved</option>
                  <option value="issued">Issued</option>
                  <option value="pending_approval">Pending Approval</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="all">All</option>
                </select>
              </div>

              {!isCenter && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    Center
                  </label>
                  <select
                    value={certCenterFilter}
                    onChange={(e) => setCertCenterFilter(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-xs font-bold text-amber-400 focus:border-amber-500 outline-none uppercase"
                  >
                    <option value="all">All Centers</option>
                    {availableCenters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <div className="py-16 text-center text-xs text-zinc-400 flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                  <span>Loading marksheets...</span>
                </div>
              ) : filteredCertificates.length === 0 ? (
                <div className="py-16 text-center text-xs font-bold uppercase tracking-widest text-zinc-500 bg-zinc-950/40 border border-zinc-800 rounded-xl">
                  No marksheets found matching criteria
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="text-zinc-400 uppercase tracking-widest text-[10px] font-black border-b border-zinc-800 bg-zinc-950/50">
                      <th className="py-4 px-4">Student</th>
                      <th className="py-4 px-4">Certificate No</th>
                      <th className="py-4 px-4">Template</th>
                      <th className="py-4 px-4">Course</th>
                      <th className="py-4 px-4">Status</th>
                      <th className="py-4 px-4">Issued On</th>
                      <th className="py-4 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-zinc-200 font-medium">
                    {filteredCertificates.map((c) => {
                      const cid = toId(c._id);
                      const student = studentById.get(toId(c.student_id));
                      const studentName = (c as any).student_name || student?.fullName || student?.username || "Student Candidate";
                      const tplName = c.template_id ? templateNameById.get(toId(c.template_id)) : undefined;
                      const canDownload = c.status === "approved" || c.status === "issued";

                      const rawDate = (c as any).issued_on;
                      let dateStr = "26/09/2026";
                      if (typeof rawDate === "string") {
                        const parsed = new Date(rawDate);
                        if (!isNaN(parsed.getTime())) dateStr = parsed.toLocaleDateString("en-IN");
                      } else if (rawDate && typeof rawDate === "object") {
                        const millis = rawDate.$date?.$numberLong ? Number(rawDate.$date.$numberLong) : rawDate.$date ? new Date(rawDate.$date).getTime() : NaN;
                        if (!isNaN(millis)) dateStr = new Date(millis).toLocaleDateString("en-IN");
                      }

                      return (
                        <tr key={cid} className="hover:bg-zinc-800/40 transition-colors">
                          <td className="py-4 px-4">
                            <div className="font-extrabold text-sm text-zinc-100 uppercase">{studentName}</div>
                            <div className="text-[10px] text-amber-400 font-bold uppercase tracking-tight">
                              @{student?.username || (c as any).enrollment_number || "EN2026001"}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-xs font-black text-amber-300">{c.certificate_no}</td>
                          <td className="py-4 px-4 text-xs font-bold text-zinc-400">{tplName || "Official Template"}</td>
                          <td className="py-4 px-4 text-xs font-bold text-zinc-300">{c.course}</td>
                          <td className="py-4 px-4">{<StatusBadge status={c.status} />}</td>
                          <td className="py-4 px-4 text-xs font-bold text-zinc-400">{dateStr}</td>
                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isAdmin && (
                                <button
                                  onClick={() => handleDeleteCertificate(cid)}
                                  className="p-2 rounded-lg bg-zinc-950 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 border border-zinc-800 transition-all"
                                  title="Delete Marksheet"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canDownload ? (
                                <button
                                  onClick={() => handleDownload(cid, c.certificate_no)}
                                  disabled={downloading === cid}
                                  className="flex items-center justify-end gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider hover:bg-amber-400 disabled:opacity-50"
                                >
                                  {downloading === cid ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                  Download PDF
                                </button>
                              ) : (c.status === "pending_approval" && !isCenter) ? (
                                <button
                                  onClick={() => approveCertificate(cid)}
                                  disabled={approving === cid}
                                  className="flex items-center justify-end gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider hover:bg-emerald-500 disabled:opacity-50"
                                >
                                  {approving === cid ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                                  Approve
                                </button>
                              ) : (
                                <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                                  {c.status === "pending_approval" ? "Pending" : "—"}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default StudentMarksheetsPage;

