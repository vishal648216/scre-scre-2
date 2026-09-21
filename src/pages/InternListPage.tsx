
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, UserPlus, Users, Edit, Trash2, Briefcase, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
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
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  active: boolean;
  internshipDomain?: string;
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
  const location = useLocation();

  const [user, setUser] = useState<{ username: string, role: string } | null>(() => {
    const storedUser = sessionStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const currentUserRole = user?.role?.toLowerCase().replace(" ", "") || "";
  const canAddIntern = ["center", "admin", "superadmin"].includes(currentUserRole);

  useEffect(() => {
    fetchInterns();
  }, [location.pathname]);

  const fetchInterns = async () => {
    console.log("[InternListPage] fetchInterns called");
    setLoading(true);
    try {
      const res = await apiFetch("/api/interns");
      console.log("[InternListPage] fetchInterns res.ok:", res.ok, "status:", res.status);
      const rawData = await res.json();
      console.log("[InternListPage] raw API response from GET /api/interns:", rawData);
      
      if (res.ok) {
        const mapped = rawData.map((s: any) => ({
          ...s,
          _id: toId(s._id || s.id),
          fullName: s.fullName || s.full_name
        }));
        console.log("[InternListPage] mapped response:", mapped);
        
        const filtered = mapped.filter(s =>
          ((s.fullName || "").toLowerCase().includes(search.toLowerCase()) ||
            s.username.toLowerCase().includes(search.toLowerCase()))
        );
        console.log("[InternListPage] final filtered array before setState:", filtered);
        setInterns(mapped);
      }
    } catch (e) {
      console.error("[InternListPage] Failed to fetch interns", e);
    } finally {
      setLoading(false);
    }
  };

  const deleteIntern = async (id: string) => {
    if (!window.confirm(t("Are you sure you want to delete this intern?"))) return;
    try {
      const res = await apiFetch(`/api/interns/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(t("Intern deleted successfully"));
        fetchInterns();
      } else {
        toast.error(t("Failed to delete intern"));
      }
    } catch (e) {
      toast.error(t("An error occurred"));
    }
  };

  const filtered = interns.filter(s =>
    ((s.fullName || "").toLowerCase().includes(search.toLowerCase()) ||
      s.username.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">{t("All Interns")}</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              {t("View and search interns registered in the system.")}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {canAddIntern && (
              <Link to="/dashboard/interns/add" className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-none font-heading font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:opacity-90 transition-all">
                <UserPlus className="w-4 h-4" /> {t("Add Intern")}
              </Link>
            )}
          </div>
        </div>

        <Card className="rounded-none border-border shadow-md overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                {t("Intern Directory")}
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
              <div className="p-8 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("Loading...")}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("No interns found")}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/10 text-muted-foreground uppercase text-[10px] font-black tracking-widest">
                      <th className="px-6 py-4">{t("Name")}</th>
                      <th className="px-6 py-4">{t("Username")}</th>
                      <th className="px-6 py-4">{t("Internship Domain")}</th>
                      <th className="px-6 py-4">{t("Phone")}</th>
                      <th className="px-6 py-4">{t("Address")}</th>
                      <th className="px-6 py-4">{t("Status")}</th>
                      <th className="px-6 py-4 text-right">{t("Actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="font-medium">
                    {filtered.map(s => {
                      const sid = toId(s._id);
                      const locationParts = [s.country, s.state, s.city].filter(Boolean).join(" / ");
                      const addressLine = [s.address, s.pincode].filter(Boolean).join(", ");
                      return (
                        <tr key={sid} className="border-b border-border last:border-0 hover:bg-primary/5 transition-colors">
                          <td className="px-6 py-4">{t(s.fullName || "Not Provided")}</td>
                          <td className="px-6 py-4">{s.username}</td>
                          <td className="px-6 py-4">{t(s.internshipDomain || "—")}</td>
                          <td className="px-6 py-4">{s.phone || "—"}</td>
                          <td className="px-6 py-4 text-xs">
                            <div className="flex flex-col gap-1">
                              <span>{locationParts || "—"}</span>
                              {addressLine ? <span className="text-muted-foreground">{addressLine}</span> : null}
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
                              <Link
                                to={`/dashboard/interns/edit/${sid}`}
                                className="p-2 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
                                title={t("Edit")}
                              >
                                <Edit className="w-4 h-4" />
                              </Link>
                              <button
                                onClick={() => deleteIntern(sid)}
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

export default InternListPage;
