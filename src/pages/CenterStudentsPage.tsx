import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, UserPlus, Users, Edit, Trash2, CheckCircle, XCircle, Loader2, Ticket, FileText, IdCard, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

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

  const [user, setUser] = useState<{ username: string, role: string } | null>(() => {
    const storedUser = sessionStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const currentUserRole = user?.role?.toLowerCase().replace(" ", "") || "";
  const canAddStudent = currentUserRole === "center";

  const downloadEnrollmentPdf = async (studentId: string) => {
    try {
      const res = await apiFetch(`/api/students/${studentId}/enrollment-pdf`);
      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/pdf")) {
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
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
        window.open(data.pdf_url, '_blank');
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
          const a = document.createElement('a');
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

  useEffect(() => {
    fetchStudents();
  }, []);

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
        setCentersList(data);
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
        // Map id to _id, full_name to fullName for frontend consistency
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
    } catch (e) {
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
    } catch (e) {
      toast.error(t("An error occurred"));
    }
  };

  const filtered = students.filter(s =>
    ((s.fullName || "").toLowerCase().includes(search.toLowerCase()) ||
      s.username.toLowerCase().includes(search.toLowerCase())) &&
    (selectedCourse === "All" || s.course === selectedCourse)
  );

  const courses = ["All", ...Array.from(new Set(students.map(s => s.course).filter(Boolean)))];

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
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">{t("All Students")}</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              {canAddStudent ? t("View and search students enrolled under your center.") : t("View all students registered across the system.")}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="bg-card border border-border px-4 py-3 rounded-none font-heading font-black text-[10px] uppercase tracking-widest outline-none focus:border-primary shadow-sm"
            >
              {courses.map(c => <option key={String(c)} value={String(c)}>{t(String(c))}</option>)}
            </select>
            {canAddStudent && (
              <Link to="/dashboard/students/add" className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-none font-heading font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:opacity-90 transition-all">
                <UserPlus className="w-4 h-4" /> {t("Add Student")}
              </Link>
            )}
          </div>
        </div>

        <Card className="rounded-none border-border shadow-md overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                {t("Student Directory")}
              </CardTitle>
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  placeholder={t("Search...")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-none text-xs font-bold uppercase tracking-widest focus:border-primary outline-none"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("Loading...")}</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("No students found")}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/10 text-muted-foreground uppercase text-[10px] font-black tracking-widest">
                      <th className="px-6 py-4">{t("Name")}</th>
                      <th className="px-6 py-4">{t("Username")}</th>
                      <th className="px-6 py-4">{t("Course")}</th>
                      <th className="px-6 py-4">{t("Personal Mobile")}</th>
                      <th className="px-6 py-4">{t("Address")}</th>
                      <th className="px-6 py-4">{t("Government ID")}</th>
                      <th className="px-6 py-4">{t("Documents")}</th>
                      <th className="px-6 py-4">{t("Status")}</th>
                      <th className="px-6 py-4 text-right">{t("Actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="font-medium">
                    {filtered.map(s => {
                      const sid = toId(s._id);
                      const docs = parseDocs(s.additional_docs);
                      const locationParts = [s.country, s.state, s.city].filter(Boolean).join(" / ");
                      const addressLine = [s.address, s.pincode].filter(Boolean).join(", ");
                      const nationalId = s.national_id
                        ? `${t(s.national_id_type || "Government ID")}: ${s.national_id}`
                        : "—";
                      return (
                        <tr key={sid} className="border-b border-border last:border-0 hover:bg-primary/5 transition-colors">
                          <td className="px-6 py-4">{t(s.fullName || "Not Provided")}</td>
                          <td className="px-6 py-4">{s.username}</td>
                          <td className="px-6 py-4">{t(s.course || "—")}</td>
                          <td className="px-6 py-4">{s.phone || "—"}</td>
                          <td className="px-6 py-4 text-xs">
                            <div className="flex flex-col gap-1">
                              <span>{locationParts || "—"}</span>
                              {addressLine ? <span className="text-muted-foreground">{addressLine}</span> : null}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs">{nationalId}</td>
                          <td className="px-6 py-4 text-xs">
                            <div className="flex flex-col gap-1">
                              {docs.tenth_dmc_url ? <a className="text-primary underline" target="_blank" rel="noreferrer" href={docs.tenth_dmc_url}>{t("10th DMC")}</a> : null}
                              {docs.national_id_image_url ? <a className="text-primary underline" target="_blank" rel="noreferrer" href={docs.national_id_image_url}>{t("Government ID Image")}</a> : null}
                              {s.signature_url ? <a className="text-primary underline" target="_blank" rel="noreferrer" href={s.signature_url}>{t("Signature")}</a> : null}
                              {!docs.tenth_dmc_url && !docs.national_id_image_url && !s.signature_url ? "—" : null}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "text-[10px] font-black uppercase tracking-widest px-2 py-1",
                              s.active ? "bg-emerald-500/10 text-emerald-500" : "bg-destructive/10 text-destructive"
                            )}>
                              {s.active ? t("Active") : t("Disabled")}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => downloadEnrollmentPdf(sid)}
                                className="p-2 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
                                title={t("Enrollment Receipt")}
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => downloadIdCardPdf(sid)}
                                className="p-2 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
                                title={t("ID Card")}
                              >
                                <IdCard className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => downloadHallTicket(sid)}
                                className="p-2 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
                                title={t("Hall Ticket")}
                              >
                                <Ticket className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => openStudentTransferModal(s)}
                                className="p-2 hover:bg-purple-500/10 text-muted-foreground hover:text-purple-500 transition-all"
                                title={t("Transfer Student")}
                              >
                                <ArrowRightLeft className="w-4 h-4" />
                              </button>
                              <Link
                                to={`/dashboard/students/edit/${sid}`}
                                className="p-2 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
                                title={t("Edit")}
                              >
                                <Edit className="w-4 h-4" />
                              </Link>
                              <button
                                onClick={() => toggleStatus(sid, s.active)}
                                className={cn(
                                  "p-2 transition-all",
                                  s.active ? "text-muted-foreground hover:text-destructive hover:bg-destructive/10" : "text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10"
                                )}
                                title={s.active ? t("Disable") : t("Enable")}
                              >
                                {s.active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => deleteStudent(sid)}
                                className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                                title={t("Delete")}
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

      {/* Student Transfer Modal */}
      <Dialog open={!!transferStudentItem} onOpenChange={(open) => !open && setTransferStudentItem(null)}>
        <DialogContent className="max-w-md rounded-xl border border-border bg-card shadow-2xl">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                <ArrowRightLeft className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <h3 className="font-heading font-extrabold text-base text-foreground uppercase tracking-tight">
                  {t("Transfer Student Branch")}
                </h3>
                <p className="text-xs text-muted-foreground font-medium">
                  {t("Re-allocate student to a new center branch")}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>

          {transferStudentItem && (
            <form onSubmit={handleStudentTransferSubmit} className="space-y-4 py-3 text-xs">
              <div className="p-3 rounded-xl bg-muted/30 border border-border">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">{t("Student")}:</span>
                <p className="font-extrabold text-foreground text-sm">{transferStudentItem.fullName || transferStudentItem.username}</p>
                <p className="text-[11px] text-muted-foreground">Username: @{transferStudentItem.username} | Course: {transferStudentItem.course || "N/A"}</p>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground uppercase text-[10px]">{t("Target Center Branch")} *</label>
                <select
                  value={targetCenterId}
                  onChange={(e) => {
                    const selected = centersList.find(c => c._id === e.target.value);
                    setTargetCenterId(e.target.value);
                    if (selected) {
                      setTargetCenterCode(selected.code);
                      setTargetCenterName(selected.name);
                    }
                  }}
                  className="w-full px-3.5 py-2 rounded-lg border border-border bg-background font-bold text-xs focus:border-primary outline-none"
                >
                  {centersList.map(c => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground uppercase text-[10px]">{t("Transfer Reason / Remarks")}</label>
                <textarea
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-lg border border-border bg-background font-bold text-xs focus:border-primary outline-none"
                  placeholder={t("Enter justification notes...")}
                />
              </div>

              <DialogFooter className="border-t border-border pt-3 flex gap-2">
                <button
                  type="submit"
                  disabled={transferring}
                  className="px-5 py-2 rounded-lg bg-purple-600 text-white font-black text-xs uppercase tracking-wider hover:bg-purple-700 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {transferring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
                  {t("Confirm Transfer")}
                </button>
                <button
                  type="button"
                  onClick={() => setTransferStudentItem(null)}
                  className="px-4 py-2 rounded-lg border border-border bg-card font-bold text-xs uppercase tracking-wider"
                >
                  {t("Cancel")}
                </button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default CenterStudentsPage;
