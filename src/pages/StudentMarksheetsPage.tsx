import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award as CertIcon, User, Search, Save, FileText, Stamp, Loader2, Layers, Download, Printer, CheckCircle, Clock, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

const StatusBadge = ({ status }: { status?: string }) => {
  const s = (status || "").toLowerCase();
  if (s === 'approved' || s === 'issued') {
    return (
      <div className="flex items-center gap-1.5 text-green-600">
        <CheckCircle className="w-3.5 h-3.5" />
        <p className="text-[10px] uppercase font-bold tracking-widest">Issued</p>
      </div>
    );
  }
  if (s === 'scheduled') {
    return (
      <div className="flex items-center gap-1.5 text-amber-600">
        <Clock className="w-3.5 h-3.5" />
        <p className="text-[10px] uppercase font-bold tracking-widest">Scheduled</p>
      </div>
    );
  }
  if (s === 'pending_approval') {
    return (
      <div className="flex items-center gap-1.5 text-gray-500">
        <Clock className="w-3.5 h-3.5" />
        <p className="text-[10px] uppercase font-bold tracking-widest">Pending Approval</p>
      </div>
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
  const [selected, setSelected] = useState<Student | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [issuing, setIssuing] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [certMode, setCertMode] = useState("single");
  const [saving, setSaving] = useState(false);
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
      if (sRes.ok) setStudents(sData);
      if (cRes.ok) setCerts(cData);
    } catch (e) {
      console.error("Failed to load marksheets", e);
      toast.error("Failed to load marksheets");
    } finally {
      setLoading(false);
    }
  };

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
          const filePath = (c.file_path || c.pdf_path || c.pdf_url || "").toLowerCase();
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
    templates,
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
    } catch (e) {
      toast.error("Bulk download failed");
    } finally {
      setBulkDownloading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Student Marksheets</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">Issue and track course marksheets.</p>
          </div>
          <div className="flex items-center gap-2 w-full max-w-md">
            <button
              onClick={selectAllFiltered}
              className="px-3 py-2 bg-muted border border-border text-[10px] font-black uppercase tracking-widest hover:bg-muted/80 whitespace-nowrap"
            >
              {filtered.length > 0 && filtered.every(s => selectedIds.has(studentIdStr(s))) ? "Deselect All" : "Select All"}
            </button>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                placeholder="Search students..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-none text-xs font-bold uppercase tracking-widest focus:border-primary outline-none"
              />
            </div>
          </div>
        </div>

        {/* Student Marksheets (Issued) - table + filters + bulk single-PDF download */}
        <Card className="rounded-none border-border shadow-sm overflow-hidden mt-10">
          <CardHeader className="bg-muted/20 border-b border-border py-4">
            <div className="flex items-start justify-between gap-4 flex-col md:flex-row md:items-center">
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">
                  Student Marksheets
                </CardTitle>
                <p className="text-muted-foreground text-xs font-medium mt-1">
                  Filter marksheets and download them in a single PDF.
                </p>
              </div>

              <button
                onClick={handleDownloadBulk}
                disabled={bulkDownloading || filteredCertificates.length === 0}
                className="px-6 py-4 rounded-none bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {bulkDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Download All (Single PDF){" "}
                <span className="ml-1 text-primary-foreground/80">
                  ({filteredCertificates.length})
                </span>
              </button>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-muted-foreground">
                  Search
                </label>
                <input
                  value={certSearch}
                  onChange={(e) => setCertSearch(e.target.value)}
                  placeholder="Search by certificate no / course / student..."
                  className="w-full px-4 py-3 rounded-none border border-border bg-background text-xs font-bold focus:border-primary outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-muted-foreground">
                  Template
                </label>
                <select
                  value={certTemplateFilter}
                  onChange={(e) => setCertTemplateFilter(e.target.value)}
                  className="w-full px-4 py-3 rounded-none border border-border bg-background text-xs font-bold focus:border-primary outline-none"
                >
                  <option value="all">All Templates</option>
                  {templates.map((t) => (
                    <option key={toId(t._id)} value={toId(t._id)}>
                      {t.template_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-muted-foreground">
                  Course
                </label>
                <select
                  value={certCourseFilter}
                  onChange={(e) => setCertCourseFilter(e.target.value)}
                  className="w-full px-4 py-3 rounded-none border border-border bg-background text-xs font-bold focus:border-primary outline-none"
                >
                  <option value="all">All Courses</option>
                  {availableCourses.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-muted-foreground">
                  Status
                </label>
                <select
                  value={certStatusFilter}
                  onChange={(e) => setCertStatusFilter(e.target.value)}
                  className="w-full px-4 py-3 rounded-none border border-border bg-background text-xs font-bold focus:border-primary outline-none"
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
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-muted-foreground">
                    Center
                  </label>
                  <select
                    value={certCenterFilter}
                    onChange={(e) => setCertCenterFilter(e.target.value)}
                    className="w-full px-4 py-3 rounded-none border border-border bg-background text-xs font-bold focus:border-primary outline-none"
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

            <div className="mt-6 overflow-x-auto">
              {loading ? (
                <div className="py-12 text-center text-xs text-muted-foreground">Loading...</div>
              ) : filteredCertificates.length === 0 ? (
                <div className="py-12 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground bg-muted/5 border border-border">
                  No marksheets found
                </div>
              ) : (
                <table className="w-full min-w-[980px] border-collapse">
                  <thead>
                    <tr className="text-left text-muted-foreground uppercase tracking-widest text-[10px] font-black border-b border-border">
                      <th className="py-3 px-3">Student</th>
                      <th className="py-3 px-3">Certificate No</th>
                      <th className="py-3 px-3">Template</th>
                      <th className="py-3 px-3">Course</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Issued On</th>
                      <th className="py-3 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCertificates.map((c) => {
                      const cid = toId(c._id);
                      const student = studentById.get(toId(c.student_id));
                      const studentName = student?.fullName || student?.username || "";
                      const tplName = c.template_id ? templateNameById.get(toId(c.template_id)) : undefined;
                      const canDownload = c.status === "approved" || c.status === "issued";
                      return (
                        <tr key={cid} className="border-b border-border hover:bg-muted/10">
                          <td className="py-3 px-3">
                            <div className="font-bold text-xs text-foreground">{studentName}</div>
                            <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">
                              {student?.username || ""}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-xs font-black text-foreground">{c.certificate_no}</td>
                          <td className="py-3 px-3 text-xs font-bold text-muted-foreground">{tplName || "N/A"}</td>
                          <td className="py-3 px-3 text-xs font-bold text-muted-foreground">{c.course}</td>
                          <td className="py-3 px-3">{<StatusBadge status={c.status} />}</td>
                          <td className="py-3 px-3 text-xs font-bold text-muted-foreground">
                            {c.issued_on ? new Date(c.issued_on).toLocaleDateString() : "-"}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isAdmin && (
                                <button
                                  onClick={() => handleDeleteCertificate(cid)}
                                  className="p-2 border border-border hover:border-red-500 hover:text-red-500 transition-all"
                                  title="Delete Marksheet"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canDownload ? (
                                <button
                                  onClick={() => handleDownload(cid, c.certificate_no)}
                                  disabled={downloading === cid}
                                  className="flex items-center justify-end gap-2 px-4 py-2 rounded-none bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest hover:opacity-90 disabled:opacity-50"
                                >
                                  {downloading === cid ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                                  Download
                                </button>
                              ) : (c.status === "pending_approval" && !isCenter) ? (
                                <button
                                  onClick={() => approveCertificate(cid)}
                                  disabled={approving === cid}
                                  className="flex items-center justify-end gap-2 px-4 py-2 rounded-none bg-green-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-green-700 disabled:opacity-50 shadow-md"
                                >
                                  {approving === cid ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                                  Approve
                                </button>
                              ) : (
                                <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
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
