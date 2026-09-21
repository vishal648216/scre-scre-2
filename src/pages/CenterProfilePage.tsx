import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { Building2, MapPin, Laptop, Clock, School, ShieldCheck, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toId } from "@/lib/utils";

type Course = {
  _id: string;
  course_name: string;
  course_code: string;
  status: string;
};

type Center = {
  _id: string;
  name: string;
  code: string;
  owner_name: string;
  about_center?: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  active: boolean;
  location?: { country?: string; pincode?: string; maps_embed_url?: string };
  infrastructure?: { computers?: number; classrooms?: number; staff?: number; lab_type?: string; internet_available?: boolean; power_backup?: boolean };
  course_allotment?: string[];
  branding_media?: { center_logo_url?: string; banner_image_url?: string; gallery_urls?: string[] };
  working_hours?: { opening_time?: string; closing_time?: string; working_days?: string[] };
  config_validity?: { creation_date?: string; validity_date?: string; franchise_fee?: number; royalty_percent?: number };
};

const CenterProfilePage = () => {
  const { t } = useTranslation();
  const [center, setCenter] = useState<Center | null>(null);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch("/api/centers").then((r) => r.json()),
      apiFetch("/api/public/courses").then((r) => r.json()),
    ])
      .then(([centerData, coursesData]) => {
        const list = Array.isArray(centerData) ? (centerData as Center[]) : [];
        setCenter(list[0] || null);
        setAllCourses(Array.isArray(coursesData) ? coursesData : []);
      })
      .catch(() => setCenter(null))
      .finally(() => setLoading(false));
  }, []);

  const getAllottedCourseNames = () => {
    if (!center || !center.course_allotment) return [];
    return center.course_allotment
      .map((idOrName) => {
        const course = allCourses.find(
          (c) => toId(c._id) === idOrName || c.course_name.toLowerCase() === idOrName.toLowerCase()
        );
        return course && course.status === "active" ? course.course_name : null;
      })
      .filter(Boolean) as string[];
  };

  const allottedCourseNames = getAllottedCourseNames();

  return (
    <DashboardLayout role={t("Center")}>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">{t("My Center Profile")}</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">{t("Your center details as configured by admin.")}</p>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">{t("Loading…")}</div>
        ) : !center ? (
          <Card className="rounded-none border-border">
            <CardContent className="p-8 text-sm text-muted-foreground">
              {t("No center profile found for this login.")}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="rounded-none border-border shadow-md lg:col-span-2 overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border py-4">
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  {t("Center Overview")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Code")}: {center.code}</div>
                    <div className="text-2xl font-extrabold uppercase tracking-tight">{t(center.name)}</div>
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-2 border border-emerald-500/20 bg-emerald-500/5 text-emerald-600 text-[10px] font-black uppercase tracking-widest">
                    <ShieldCheck className="w-4 h-4" />
                    {center.active ? t("Active") : t("Suspended")}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  <span className="font-bold text-foreground">{t("Owner")}:</span> {center.owner_name}
                  <span className="mx-3">•</span>
                  <span className="font-bold text-foreground">{t("Phone")}:</span> {center.phone}
                  <span className="mx-3">•</span>
                  <span className="font-bold text-foreground">{t("Email")}:</span> {center.email}
                </div>
                <div className="text-sm text-muted-foreground flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5 text-primary" />
                  <div>
                    <div className="font-bold text-foreground uppercase">{t(center.city)}, {t(center.state)}</div>
                    <div className="text-[10px] uppercase tracking-widest">
                      {t(center.location?.country || "—")} {center.location?.pincode ? `• ${center.location.pincode}` : ""}
                    </div>
                    <div className="mt-1">{t(center.address)}</div>
                    {center.location?.maps_embed_url ? (
                      <a className="mt-2 inline-block text-[10px] font-black uppercase tracking-widest underline" href={center.location.maps_embed_url} target="_blank" rel="noreferrer">
                        {t("Open Map")}
                      </a>
                    ) : null}
                  </div>
                </div>
                <div className="border border-border p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("About Center")}</div>
                  <div className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    {t(center.about_center || "—")}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-none border-border shadow-md overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border py-4">
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  {t("Validity & Hours")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4 text-sm">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Validity")}</div>
                  <div className="font-bold">{center.config_validity?.validity_date || "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Working Hours")}</div>
                  <div className="font-bold">{center.working_hours?.opening_time || "—"} - {center.working_hours?.closing_time || "—"}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t("Days")}: {(center.working_hours?.working_days || []).map(d => t(d)).join(", ") || "—"}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-none border-border shadow-md overflow-hidden lg:col-span-2">
              <CardHeader className="bg-muted/30 border-b border-border py-4">
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-primary" />
                  {t("Infrastructure & Compliance")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <Info label={t("Computers")} value={String(center.infrastructure?.computers ?? "—")} />
                <Info label={t("Classrooms")} value={String(center.infrastructure?.classrooms ?? "—")} />
                <Info label={t("Staff")} value={String(center.infrastructure?.staff ?? "—")} />
                <Info label={t("Lab Type")} value={t(center.infrastructure?.lab_type || "—")} />
                <Info label={t("Internet")} value={center.infrastructure?.internet_available === undefined ? "—" : center.infrastructure.internet_available ? t("Yes") : t("No")} />
                <Info label={t("Power Backup")} value={center.infrastructure?.power_backup === undefined ? "—" : center.infrastructure.power_backup ? t("Yes") : t("No")} />
              </CardContent>
            </Card>

            <Card className="rounded-none border-border shadow-md overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border py-4">
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <School className="w-4 h-4 text-primary" />
                  {t("Courses Allotted")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {allottedCourseNames.length ? (
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    {allottedCourseNames.map((c) => (
                      <li key={c}>{t(c)}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-muted-foreground">{t("No courses allotted.")}</div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-none border-border shadow-md overflow-hidden lg:col-span-3">
              <CardHeader className="bg-muted/30 border-b border-border py-4">
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  {t("Gallery")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {center.branding_media?.gallery_urls?.length ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {center.branding_media.gallery_urls.slice(0, 12).map((u) => (
                      <a key={u} href={u} target="_blank" rel="noreferrer" className="block border border-border overflow-hidden">
                        <img src={u} alt={t("Gallery")} className="w-full h-28 object-cover" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">{t("No gallery images uploaded.")}</div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

const Info = ({ label, value }: { label: string; value: string }) => (
  <div className="border border-border p-4">
    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</div>
    <div className="text-lg font-extrabold text-foreground">{value}</div>
  </div>
);

export default CenterProfilePage;

