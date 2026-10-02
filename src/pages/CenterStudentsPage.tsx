import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, UserPlus, Users, Edit, Trash2, CheckCircle, XCircle, Loader2, Ticket, FileText, IdCard, ArrowRightLeft, Building2, GraduationCap, ShieldCheck, Sparkles, Filter, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface Student {
  _id: any;
  username: string;
  fullName?: string;
  course?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  national_id_type?: string;
  national_id?: string;
  signature_url?: string;
  additional_docs?: string;
  active: boolean;
  center_code?: string;
  center_name?: string;
}

interface CenterBranch {
  _id: string;
  name: string;
  code: string;
}

const toId = (v: unknown): string => {
  if (!v) return "";
  if (typeof v === "string") return v.replace(/^@/, "");
  if (typeof v === "object") {
    const obj = v as any;
    if (obj.$oid) return String(obj.$oid).replace(/^@/, "");
    if (obj._id) return toId(obj._id);
    if (obj.id) return toId(obj.id);
    if (obj.user_id) return toId(obj.user_id);
    if (obj.toString && typeof obj.toString === "function" && obj.toString() !== "[object Object]") {
      return obj.toString().replace(/^@/, "");
    }
  }
  return String(v ?? "").replace(/^@/, "");
};

const CenterStudentsPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("All");
  const [selectedCenterFilter, setSelectedCenterFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // View Student Modal State
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [showStudentPassword, setShowStudentPassword] = useState(false);
  const [studentPasswordInput, setStudentPasswordInput] = useState("");
  const [savingStudentPassword, setSavingStudentPassword] = useState(false);

  const handleSaveStudentPassword = async () => {
    if (!viewingStudent || !studentPasswordInput) return;
    setSavingStudentPassword(true);
    try {
      const sid = toId(viewingStudent._id || (viewingStudent as any).id);
      const res = await apiFetch(`/api/students/${sid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: studentPasswordInput })
      });
      if (res.ok) {
        toast.success(t("Student password updated successfully!"));
        setViewingStudent({ ...viewingStudent, password: studentPasswordInput, raw_password: studentPasswordInput } as any);
        fetchStudents();
      } else {
        toast.error(t("Failed to update student password"));
      }
    } catch {
      toast.error(t("Error updating student password"));
    } finally {
      setSavingStudentPassword(false);
    }
  };


  const [user, setUser] = useState<{ username: string; role: string } | null>(() => {
    const storedUser = sessionStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const currentUserRole = user?.role?.toLowerCase().replace(" ", "") || "";
  const canAddStudent = currentUserRole === "center" || currentUserRole === "superadmin" || currentUserRole === "admin";
  const isSuperAdminOrAdmin = currentUserRole === "superadmin" || currentUserRole === "admin";

  const downloadEnrollmentPdf = async (studentId: string) => {
    try {
      const res = await apiFetch(`/api/students/${studentId}/enrollment-pdf`);
      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/pdf")) {
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `enrollment_${studentId}.pdf`;
          document.body.appendChild(a);
          a.click();
          a.remove();
        } else {
          const htmlText = await res.text();
          const win = window.open("", "_blank");
          if (win) {
            win.document.write(htmlText);
            win.document.close();
          }
        }
      } else {
        toast.error(t("Failed to download PDF"));
      }
    } catch {
      toast.error(t("Error downloading PDF"));
    }
  };

  const downloadHallTicket = async (studentId: string) => {
    try {
      const res = await apiFetch(`/api/exam/hall-ticket/${studentId}`);
      const data = await res.json();
      if (res.ok && data.pdf_url) {
        window.open(data.pdf_url, "_blank");
      } else {
        toast.error(data.message || "Failed to generate hall ticket");
      }
    } catch {
      toast.error("Failed to generate hall ticket");
    }
  };

  const downloadIdCardPdf = async (studentId: string) => {
    try {
      const res = await apiFetch(`/api/students/${studentId}/id-card-pdf`);
      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/pdf")) {
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `id_card_${studentId}.pdf`;
          document.body.appendChild(a);
          a.click();
          a.remove();
        } else {
          const htmlText = await res.text();
          const win = window.open("", "_blank");
          if (win) {
            win.document.write(htmlText);
            win.document.close();
          }
        }
      } else {
        toast.error(t("Failed to download ID Card PDF"));
      }
    } catch {
      toast.error(t("Error downloading ID Card PDF"));
    }
  };

  const [transferStudentItem, setTransferStudentItem] = useState<Student | null>(null);
  const [centersList, setCentersList] = useState<CenterBranch[]>([]);
  const [targetCenterId, setTargetCenterId] = useState("");
  const [targetCenterCode, setTargetCenterCode] = useState("");
  const [targetCenterName, setTargetCenterName] = useState("");
  const [transferReason, setTransferReason] = useState("Administrative Transfer");
  const [transferring, setTransferring] = useState(false);

  const fetchCentersList = async () => {
    try {
      const res = await apiFetch("/api/centers");
      if (res.ok) {
        const data = await res.json();
        setCentersList(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Failed to fetch centers for transfer", e);
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchCentersList();
  }, []);

  const openStudentTransferModal = (student: Student) => {
    setTransferStudentItem(student);
    setTransferReason("Administrative Center Transfer");
    if (centersList.length > 0) {
      const c = centersList[0];
      setTargetCenterId(c._id);
      setTargetCenterCode(c.code);
      setTargetCenterName(c.name);
    }
  };

  const handleStudentTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferStudentItem || !targetCenterId) return;
    setTransferring(true);
    try {
      const rawSid = transferStudentItem._id || (transferStudentItem as any).id || (transferStudentItem as any).user_id || transferStudentItem.username || (transferStudentItem as any).registration_number;
      const sid = toId(rawSid);
      const url = sid ? `/api/students/${encodeURIComponent(sid)}/transfer` : `/api/students/transfer`;
      const res = await apiFetch(url, {
        method: "POST",
        body: JSON.stringify({
          student_id: sid || transferStudentItem.username,
          target_center_id: targetCenterId,
          target_center_code: targetCenterCode,
          target_center_name: targetCenterName,
          transfer_reason: transferReason
        })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success !== false) {
        toast.success(data.message || t("Student transferred successfully!"));
        setTransferStudentItem(null);
        fetchStudents();
      } else {
        toast.error(data.message || t("Failed to transfer student"));
      }
    } catch {
      toast.error(t("Network error transferring student"));
    } finally {
      setTransferring(false);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/students");
      const data = await res.json();
      if (res.ok) {
        const mapped = data.map((s: any) => ({
          ...s,
          _id: s._id || s.id || s.user_id,
          id: s.id || s._id || s.user_id,
          fullName: s.fullName || s.full_name || s.name
        }));
        setStudents(mapped);
      }
    } catch (e) {
      console.error("Failed to fetch students", e);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const res = await apiFetch(`/api/admin/students/${id}/toggle-active`, {
        method: "POST"
      });
      if (res.ok) {
        toast.success(t("Status updated"));
        fetchStudents();
      } else {
        toast.error(t("Failed to update status"));
      }
    } catch {
      toast.error(t("An error occurred"));
    }
  };

  const deleteStudent = async (id: string) => {
    if (!window.confirm(t("Are you sure you want to move this student to the recycle bin?"))) return;
    try {
      const res = await apiFetch(`/api/students/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        toast.success(t("Student moved to recycle bin"));
        fetchStudents();
      } else {
        toast.error(t("Failed to delete student"));
      }
    } catch {
      toast.error(t("An error occurred"));
    }
  };

  useEffect(() => {
    setPage(1);
  }, [search, selectedCourse, selectedCenterFilter]);

  const filtered = students.filter((s) => {
    const nameMatch = (s.fullName || "").toLowerCase().includes(search.toLowerCase()) || s.username.toLowerCase().includes(search.toLowerCase());
    const courseMatch = selectedCourse === "All" || s.course === selectedCourse;
    const centerMatch = selectedCenterFilter === "All" || s.center_name === selectedCenterFilter || s.center_code === selectedCenterFilter;
    return nameMatch && courseMatch && centerMatch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const courses = ["All", ...Array.from(new Set(students.map((s) => s.course).filter(Boolean)))];
  const centerNames = ["All", ...Array.from(new Set(students.map((s) => s.center_name).filter(Boolean)))];

  const activeStudentsCount = students.filter((s) => s.active).length;

  const parseDocs = (raw?: string): Record<string, string> => {
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-heading font-extrabold text-2xl md:text-3xl text-zinc-100 uppercase tracking-tight">
                  {t("All Students Directory")}
                </h1>
                <p className="text-zinc-400 text-xs font-medium">
                  {isSuperAdminOrAdmin
                    ? t("Viewing all registered students across all network centers.")
                    : t("Manage and search students enrolled under your specific center.")}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {canAddStudent && (
              <Link
                to="/dashboard/students/add"
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 px-5 py-2.5 rounded-xl font-heading font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/10 transition-all"
              >
                <UserPlus className="w-4 h-4" /> {t("Add New Student")}
              </Link>
            )}
          </div>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-zinc-900/90 border border-zinc-800 p-5 rounded-2xl shadow-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Total Enrolled Students</p>
              <h3 className="text-2xl font-black text-zinc-100 mt-1">{students.length}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800 p-5 rounded-2xl shadow-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Active Students</p>
              <h3 className="text-2xl font-black text-emerald-400 mt-1">{activeStudentsCount}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800 p-5 rounded-2xl shadow-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Courses Active</p>
              <h3 className="text-2xl font-black text-blue-400 mt-1">{courses.length - 1}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <GraduationCap className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800 p-5 rounded-2xl shadow-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Total Centers</p>
              <h3 className="text-2xl font-black text-purple-400 mt-1">{centersList.length || 1}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Building2 className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Directory Card */}
        <Card className="rounded-2xl border-zinc-800 bg-zinc-900/90 shadow-xl overflow-hidden">
          <CardHeader className="bg-zinc-900/80 border-b border-zinc-800 p-5">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2 text-zinc-200">
                <Users className="w-4 h-4 text-amber-400" />
                {t("Student Records Directory")} ({filtered.length})
              </CardTitle>

              <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    placeholder={t("Search by name, roll, mobile...")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500 outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={selectedCourse}
                    onChange={(e) => setSelectedCourse(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 text-zinc-200 px-3 py-2 rounded-xl font-bold text-xs uppercase tracking-wider outline-none focus:border-amber-500"
                  >
                    <option value="All">{t("All Courses")}</option>
                    {courses.filter((c) => c !== "All").map((c) => (
                      <option key={String(c)} value={String(c)}>
                        {t(String(c))}
                      </option>
                    ))}
                  </select>

                  {isSuperAdminOrAdmin && (
                    <select
                      value={selectedCenterFilter}
                      onChange={(e) => setSelectedCenterFilter(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 text-amber-400 px-3 py-2 rounded-xl font-bold text-xs uppercase tracking-wider outline-none focus:border-amber-500"
                    >
                      <option value="All">{t("All Centers")}</option>
                      {centerNames.filter((c) => c !== "All").map((c) => (
                        <option key={String(c)} value={String(c)}>
                          {String(c)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="p-16 text-center text-xs font-bold uppercase tracking-widest text-zinc-400 flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                <span>{t("Loading student records...")}</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-16 text-center text-xs font-bold uppercase tracking-widest text-zinc-400">
                {t("No students found matching current filters.")}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-950/50 text-zinc-400 uppercase text-[10px] font-black tracking-widest">
                        <th className="px-6 py-4">{t("Student Profile")}</th>
                        <th className="px-6 py-4">{t("Course Enrolled")}</th>
                        {isSuperAdminOrAdmin && <th className="px-6 py-4">{t("Center Branch")}</th>}
                        <th className="px-6 py-4">{t("Personal Mobile")}</th>
                        <th className="px-6 py-4">{t("Location")}</th>
                        <th className="px-6 py-4">{t("Government ID")}</th>
                        <th className="px-6 py-4">{t("Documents")}</th>
                        <th className="px-6 py-4">{t("Status")}</th>
                        <th className="px-6 py-4 text-right">{t("Actions")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 font-medium text-zinc-200">
                      {paginated.map((s) => {
                        const sid = toId(s._id);
                        const docs = parseDocs(s.additional_docs);
                        const locationParts = [s.country, s.state, s.city].filter(Boolean).join(" / ");
                        const addressLine = [s.address, s.pincode].filter(Boolean).join(", ");
                        const nationalId = s.national_id ? `${t(s.national_id_type || "Government ID")}: ${s.national_id}` : "—";
                        return (
                          <tr key={sid} className="hover:bg-zinc-800/40 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-extrabold text-sm text-zinc-100 uppercase">{s.fullName || "Not Provided"}</div>
                              <span className="text-[10px] text-amber-400 font-mono">@{s.username}</span>
                            </td>
                            <td className="px-6 py-4 font-bold text-amber-300">{s.course || "—"}</td>
                            {isSuperAdminOrAdmin && (
                              <td className="px-6 py-4">
                                <Badge className="bg-purple-500/10 text-purple-300 border-purple-500/30 text-[10px] font-bold rounded-lg px-2.5 py-1">
                                  {s.center_name || s.center_code || "Main Center"}
                                </Badge>
                              </td>
                            )}
                            <td className="px-6 py-4 font-bold text-zinc-300">{s.phone || "—"}</td>
                            <td className="px-6 py-4 text-xs">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-semibold text-zinc-200">{locationParts || "—"}</span>
                                {addressLine ? <span className="text-[10px] text-zinc-400">{addressLine}</span> : null}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-xs text-zinc-300">{nationalId}</td>
                            <td className="px-6 py-4 text-xs">
                              <div className="flex flex-col gap-1">
                                {docs.tenth_dmc_url ? (
                                  <a className="text-amber-400 hover:underline text-[11px] font-bold" target="_blank" rel="noreferrer" href={docs.tenth_dmc_url}>
                                    {t("10th DMC")}
                                  </a>
                                ) : null}
                                {docs.national_id_image_url ? (
                                  <a className="text-amber-400 hover:underline text-[11px] font-bold" target="_blank" rel="noreferrer" href={docs.national_id_image_url}>
                                    {t("ID Photo")}
                                  </a>
                                ) : null}
                                {s.signature_url ? (
                                  <a className="text-amber-400 hover:underline text-[11px] font-bold" target="_blank" rel="noreferrer" href={s.signature_url}>
                                    {t("Signature")}
                                  </a>
                                ) : null}
                                {!docs.tenth_dmc_url && !docs.national_id_image_url && !s.signature_url ? <span className="text-zinc-500">—</span> : null}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={cn(
                                  "text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border",
                                  s.active
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                    : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                )}
                              >
                                {s.active ? t("Active") : t("Disabled")}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setViewingStudent(s);
                                    setShowStudentPassword(false);
                                    setStudentPasswordInput((s as any).password || (s as any).raw_password || "");
                                  }}
                                  className="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-all flex items-center gap-1"
                                  title={t("View Full Profile & Password")}
                                >
                                  <Eye className="w-4 h-4" />
                                  <span className="text-[11px] font-bold uppercase hidden lg:inline">{t("View")}</span>
                                </button>
                                <button
                                  onClick={() => downloadEnrollmentPdf(sid)}
                                  className="p-2 rounded-lg bg-zinc-950 hover:bg-amber-500/20 text-zinc-400 hover:text-amber-400 border border-zinc-800 transition-all"
                                  title={t("Enrollment Receipt PDF")}
                                >
                                  <FileText className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => downloadIdCardPdf(sid)}
                                  className="p-2 rounded-lg bg-zinc-950 hover:bg-blue-500/20 text-zinc-400 hover:text-blue-400 border border-zinc-800 transition-all"
                                  title={t("Student ID Card PDF")}
                                >
                                  <IdCard className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => downloadHallTicket(sid)}
                                  className="p-2 rounded-lg bg-zinc-950 hover:bg-emerald-500/20 text-zinc-400 hover:text-emerald-400 border border-zinc-800 transition-all"
                                  title={t("Hall Ticket")}
                                >
                                  <Ticket className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => openStudentTransferModal(s)}
                                  className="p-2 rounded-lg bg-zinc-950 hover:bg-purple-500/20 text-zinc-400 hover:text-purple-400 border border-zinc-800 transition-all"
                                  title={t("Transfer Student Branch")}
                                >
                                  <ArrowRightLeft className="w-4 h-4" />
                                </button>
                                <Link
                                  to={`/dashboard/students/edit/${sid}`}
                                  className="p-2 rounded-lg bg-zinc-950 hover:bg-amber-500/20 text-zinc-400 hover:text-amber-400 border border-zinc-800 transition-all"
                                  title={t("Edit Profile")}
                                >
                                  <Edit className="w-4 h-4" />
                                </Link>
                                <button
                                  onClick={() => toggleStatus(sid, s.active)}
                                  className={cn(
                                    "p-2 rounded-lg bg-zinc-950 border border-zinc-800 transition-all",
                                    s.active
                                      ? "text-zinc-400 hover:text-rose-400 hover:bg-rose-500/20"
                                      : "text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/20"
                                  )}
                                  title={s.active ? t("Disable Student") : t("Enable Student")}
                                >
                                  {s.active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                                </button>
                                <button
                                  onClick={() => deleteStudent(sid)}
                                  className="p-2 rounded-lg bg-zinc-950 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 border border-zinc-800 transition-all"
                                  title={t("Move to Recycle Bin")}
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

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-zinc-800 bg-zinc-950/40 text-xs font-medium text-zinc-400">
                  <div className="flex items-center gap-2">
                    <span className="uppercase text-[10px] font-bold">{t("Rows per page")}:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                      className="bg-zinc-900 border border-zinc-800 text-zinc-200 px-2.5 py-1 rounded-lg text-xs font-bold outline-none focus:border-amber-500"
                    >
                      {[10, 25, 50, 100].map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                    <span className="text-[11px] ml-2">
                      {t("Showing")} {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1} - {Math.min(page * pageSize, filtered.length)} {t("of")} {filtered.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="px-3.5 py-1.5 bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-lg text-xs font-bold uppercase disabled:opacity-40 hover:bg-zinc-800 transition-all"
                    >
                      {t("Previous")}
                    </button>
                    <span className="text-xs font-bold uppercase tracking-wider px-2 text-zinc-300">
                      {t("Page")} {page} {t("of")} {totalPages}
                    </span>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="px-3.5 py-1.5 bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-lg text-xs font-bold uppercase disabled:opacity-40 hover:bg-zinc-800 transition-all"
                    >
                      {t("Next")}
                    </button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* VIEW STUDENT PROFILE & CREDENTIALS MODAL */}
        <Dialog open={!!viewingStudent} onOpenChange={(open) => !open && setViewingStudent(null)}>
          <DialogContent className="max-w-2xl bg-zinc-950 text-zinc-100 border-zinc-800 rounded-3xl p-6 shadow-2xl overflow-y-auto max-h-[85vh] z-[20000]">
            {viewingStudent && (
              <div className="space-y-6">
                <DialogHeader className="border-b border-zinc-800 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-extrabold text-xl">
                        {(viewingStudent.fullName || viewingStudent.username).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <DialogTitle className="text-xl font-black uppercase tracking-tight text-zinc-100">
                          {viewingStudent.fullName || "Student Profile"}
                        </DialogTitle>
                        <p className="text-xs font-bold text-amber-400 font-mono mt-0.5">
                          @{viewingStudent.username} | Course: {viewingStudent.course || "N/A"}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border",
                        viewingStudent.active
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                      )}
                    >
                      {viewingStudent.active ? t("Active") : t("Disabled")}
                    </span>
                  </div>
                </DialogHeader>

                {/* Student Account Credentials & Password */}
                <div className="bg-zinc-900/90 border border-amber-500/30 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" /> Student Portal Login Credentials
                    </h4>
                    <span className="text-[10px] text-zinc-400 font-medium">Use these to log into Student Portal</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
                    <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 space-y-1">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase">Username</span>
                      <p className="font-mono font-bold text-zinc-100 text-sm">@{viewingStudent.username}</p>
                    </div>

                    <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 space-y-1">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase">Raw Password</span>
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-amber-300 text-sm tracking-widest">
                          {showStudentPassword ? ((viewingStudent as any).password || (viewingStudent as any).raw_password || "No plain password saved") : "••••••••••••"}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowStudentPassword(!showStudentPassword)}
                            className="p-1 text-zinc-400 hover:text-zinc-100 transition-colors"
                            title={showStudentPassword ? "Hide Password" : "Show Password"}
                          >
                            {showStudentPassword ? <XCircle className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          {((viewingStudent as any).password || (viewingStudent as any).raw_password) && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText((viewingStudent as any).password || (viewingStudent as any).raw_password || "");
                                toast.success("Student password copied!");
                              }}
                              className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[10px] font-bold uppercase"
                            >
                              Copy
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Change Password Input */}
                  <div className="pt-3 border-t border-zinc-800 flex flex-col sm:flex-row items-center gap-3">
                    <input
                      type="text"
                      placeholder="Enter new password to change..."
                      className="w-full px-3.5 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500 outline-none"
                      value={studentPasswordInput}
                      onChange={(e) => setStudentPasswordInput(e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={savingStudentPassword || !studentPasswordInput}
                      onClick={handleSaveStudentPassword}
                      className="w-full sm:w-auto px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
                    >
                      {savingStudentPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      {t("Save Password")}
                    </button>
                  </div>
                </div>

                {/* Detailed Information Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
                  <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 space-y-2">
                    <h5 className="font-bold uppercase tracking-wider text-amber-400 text-[11px]">{t("Personal Info")}</h5>
                    <p><span className="text-zinc-500">Full Name:</span> <strong className="text-zinc-100">{viewingStudent.fullName || "—"}</strong></p>
                    <p><span className="text-zinc-500">Phone:</span> <strong className="text-zinc-100">{viewingStudent.phone || "—"}</strong></p>
                    <p><span className="text-zinc-500 font-bold">Government ID:</span> <strong className="text-zinc-100">{viewingStudent.national_id ? `${viewingStudent.national_id_type || 'ID'}: ${viewingStudent.national_id}` : '—'}</strong></p>
                  </div>

                  <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 space-y-2">
                    <h5 className="font-bold uppercase tracking-wider text-purple-400 text-[11px]">{t("Academic & Branch")}</h5>
                    <p><span className="text-zinc-500">Course:</span> <strong className="text-amber-300">{viewingStudent.course || "—"}</strong></p>
                    <p><span className="text-zinc-500">Center Name:</span> <strong className="text-purple-300">{viewingStudent.center_name || viewingStudent.center_code || "Main Center"}</strong></p>
                    <p><span className="text-zinc-500">Center Code:</span> <strong className="text-zinc-100">{viewingStudent.center_code || "—"}</strong></p>
                  </div>
                </div>

                {/* Action Downloads */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => downloadEnrollmentPdf(toId(viewingStudent._id))}
                      className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold uppercase flex items-center gap-1.5 transition-all"
                    >
                      <FileText className="w-4 h-4" /> Enrollment PDF
                    </button>
                    <button
                      onClick={() => downloadIdCardPdf(toId(viewingStudent._id))}
                      className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-bold uppercase flex items-center gap-1.5 transition-all"
                    >
                      <IdCard className="w-4 h-4" /> ID Card PDF
                    </button>
                    <button
                      onClick={() => downloadHallTicket(toId(viewingStudent._id))}
                      className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold uppercase flex items-center gap-1.5 transition-all"
                    >
                      <Ticket className="w-4 h-4" /> Hall Ticket
                    </button>
                  </div>
                  <button
                    onClick={() => setViewingStudent(null)}
                    className="px-5 py-2 rounded-xl bg-zinc-800 text-zinc-300 font-bold text-xs uppercase hover:bg-zinc-700"
                  >
                    {t("Close")}
                  </button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Transfer Modal */}
        <Dialog open={!!transferStudentItem} onOpenChange={(open) => !open && setTransferStudentItem(null)}>
          <DialogContent className="max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl text-zinc-100 p-6">
            <DialogHeader className="border-b border-zinc-800 pb-4">
              <DialogTitle className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-400">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-base text-zinc-100 uppercase tracking-tight">
                    {t("Transfer Student Center")}
                  </h3>
                  <p className="text-xs text-zinc-400 font-medium">{t("Re-allocate student to a new center branch")}</p>
                </div>
              </DialogTitle>
            </DialogHeader>

            {transferStudentItem && (
              <form onSubmit={handleStudentTransferSubmit} className="space-y-4 py-3 text-xs">
                <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">{t("Student")}:</span>
                  <p className="font-extrabold text-amber-400 text-sm">{transferStudentItem.fullName || transferStudentItem.username}</p>
                  <p className="text-[11px] text-zinc-400">
                    Username: @{transferStudentItem.username} | Course: {transferStudentItem.course || "N/A"}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-zinc-300 uppercase text-[10px]">{t("Target Center Branch")} *</label>
                  <select
                    value={targetCenterId}
                    onChange={(e) => {
                      const selected = centersList.find((c) => c._id === e.target.value);
                      setTargetCenterId(e.target.value);
                      if (selected) {
                        setTargetCenterCode(selected.code);
                        setTargetCenterName(selected.name);
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 font-bold text-xs focus:border-amber-500 outline-none"
                  >
                    {centersList.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-zinc-300 uppercase text-[10px]">{t("Transfer Reason / Remarks")}</label>
                  <textarea
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                    rows={2}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 font-bold text-xs focus:border-amber-500 outline-none"
                    placeholder={t("Enter justification notes...")}
                  />
                </div>

                <DialogFooter className="border-t border-zinc-800 pt-4 flex gap-2">
                  <button
                    type="submit"
                    disabled={transferring}
                    className="px-5 py-2.5 rounded-xl bg-purple-600 text-white font-black text-xs uppercase tracking-wider hover:bg-purple-500 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {transferring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
                    {t("Confirm Transfer")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransferStudentItem(null)}
                    className="px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-300 font-bold text-xs uppercase tracking-wider hover:bg-zinc-800"
                  >
                    {t("Cancel")}
                  </button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default CenterStudentsPage;
