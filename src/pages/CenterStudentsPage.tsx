import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, UserPlus, Users, Edit, Trash2, CheckCircle, XCircle, Loader2, Ticket, FileText, IdCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { apiFetch, apiUrl } from "@/lib/api";

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
}

const toId = (v: unknown): string => {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "$oid" in (v as object)) return (v as { $oid: string }).$oid;
  if (v && typeof v === "object" && "_id" in (v as object)) return toId((v as any)._id);
  if (v && typeof v === "object") return JSON.stringify(v);
  return String(v ?? "");
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
        const blob = await res.blob();
        if (blob.type.includes("html")) {
          const text = await blob.text();
          const win = window.open("", "_blank");
          if (win) {
            win.document.write(text);
            win.document.close();
          }
        } else {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `enrollment_${studentId}.pdf`;
          document.body.appendChild(a);
          a.click();
          a.remove();
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
        window.open(apiUrl(data.pdf_url), '_blank');
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
        const blob = await res.blob();
        if (blob.type.includes("html")) {
          const text = await blob.text();
          const win = window.open("", "_blank");
          if (win) {
            win.document.write(text);
            win.document.close();
          }
        } else {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `id_card_${studentId}.pdf`;
          document.body.appendChild(a);
          a.click();
          a.remove();
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

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch("/api/students", { headers: { "Authorization": `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) {
        // Map id to _id, full_name to fullName for frontend consistency
        const mapped = (Array.isArray(data) ? data : []).map((s: any) => ({
          ...s,
          _id: s?.id || s?._id,
          username: s?.username || s?.email || "student",
          fullName: s?.fullName || s?.full_name || s?.name || "Not Provided"
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
      const res = await apiFetch(`/api/admin/users/${id}/toggle-active`, {
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
      const token = sessionStorage.getItem("token");
      const res = await fetch(`/api/students/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
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

  const filtered = (students || []).filter(s =>
    (((s?.fullName || "").toLowerCase().includes((search || "").toLowerCase())) ||
      ((s?.username || "").toLowerCase().includes((search || "").toLowerCase()))) &&
    (selectedCourse === "All" || s?.course === selectedCourse)
  );

  const courses = ["All", ...Array.from(new Set((students || []).map(s => s?.course).filter(Boolean)))];

  const parseDocs = (raw?: any): Record<string, string> => {
    if (!raw) return {};
    if (typeof raw === "object") return raw;
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
                              {docs.tenth_dmc_url ? <a className="text-primary underline" target="_blank" rel="noreferrer" href={apiUrl(docs.tenth_dmc_url)}>{t("10th DMC")}</a> : null}
                              {docs.national_id_image_url ? <a className="text-primary underline" target="_blank" rel="noreferrer" href={apiUrl(docs.national_id_image_url)}>{t("Government ID Image")}</a> : null}
                              {s.signature_url ? <a className="text-primary underline" target="_blank" rel="noreferrer" href={apiUrl(s.signature_url)}>{t("Signature")}</a> : null}
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
    </DashboardLayout>
  );
};

export default CenterStudentsPage;
