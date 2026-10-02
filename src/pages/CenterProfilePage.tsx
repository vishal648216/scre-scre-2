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
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight flex items-center gap-3">
            <Building2 className="w-8 h-8 text-primary" />
            {t("My Center Profile")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">{t("Your center profile, location data, allotted courses, and infrastructure details as configured by super admin.")}</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !center ? (
          <Card className="rounded-2xl border-zinc-800 bg-zinc-900/90 shadow-xl backdrop-blur-xl">
            <CardContent className="p-12 text-center text-sm font-bold text-zinc-400">
              {t("No center profile found for this login.")}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="rounded-2xl border-zinc-800 bg-zinc-900/90 shadow-xl backdrop-blur-xl lg:col-span-2 overflow-hidden hover:border-zinc-700 transition-all">
              <CardHeader className="bg-zinc-950/50 border-b border-zinc-800 py-4 px-6">
                <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-zinc-100">
                  <Building2 className="w-4 h-4 text-primary" />
                  {t("Center Overview")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">{t("Code")}: {center.code}</span>
                    <h2 className="text-2xl font-black tracking-tight text-zinc-100 mt-2">{t(center.name)}</h2>
                  </div>
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-bold uppercase tracking-wider shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                    {center.active ? t("Active") : t("Suspended")}
                  </div>
                </div>
                <div className="text-sm text-zinc-300 font-medium space-y-1">
                  <div><span className="font-bold text-zinc-100">{t("Owner / Manager")}:</span> {center.owner_name}</div>
                  <div><span className="font-bold text-zinc-100">{t("Phone")}:</span> {center.phone} • <span className="font-bold text-zinc-100">{t("Email")}:</span> {center.email}</div>
                </div>
                <div className="text-sm text-zinc-300 flex items-start gap-3 bg-zinc-950/40 border border-zinc-800 p-4 rounded-xl">
                  <MapPin className="w-5 h-5 mt-0.5 text-primary shrink-0" />
                  <div>
                    <div className="font-bold text-zinc-100 uppercase">{t(center.city)}, {t(center.state)}</div>
                    <div className="text-xs text-zinc-400 font-medium mt-0.5">
                      {t(center.location?.country || "India")} {center.location?.pincode ? `• Pincode: ${center.location.pincode}` : ""}
                    </div>
                    <div className="mt-1.5 text-zinc-300">{t(center.address)}</div>
                    {center.location?.maps_embed_url ? (
                      <a className="mt-2 inline-block text-xs font-bold text-primary hover:underline uppercase tracking-wider" href={center.location.maps_embed_url} target="_blank" rel="noreferrer">
                        {t("Open Map Location ↗")}
                      </a>
                    ) : null}
                  </div>
                </div>
                <div className="border border-zinc-800 p-4 rounded-xl bg-zinc-950/40">
                  <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t("About Center")}</div>
                  <div className="text-sm text-zinc-300 mt-2 leading-relaxed">
                    {t(center.about_center || "—")}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-zinc-800 bg-zinc-900/90 shadow-xl backdrop-blur-xl overflow-hidden hover:border-zinc-700 transition-all">
              <CardHeader className="bg-zinc-950/50 border-b border-zinc-800 py-4 px-6">
                <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-zinc-100">
                  <Clock className="w-4 h-4 text-primary" />
                  {t("Validity & Operating Hours")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4 text-sm">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{t("Franchise Validity")}</div>
                  <div className="font-bold text-zinc-100 mt-0.5">{center.config_validity?.validity_date || "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{t("Working Hours")}</div>
                  <div className="font-bold text-zinc-100 mt-0.5">{center.working_hours?.opening_time || "—"} - {center.working_hours?.closing_time || "—"}</div>
                  <div className="text-xs text-zinc-400 mt-1 font-medium">
                    {t("Working Days")}: {(center.working_hours?.working_days || []).map(d => t(d)).join(", ") || "—"}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-zinc-800 bg-zinc-900/90 shadow-xl backdrop-blur-xl lg:col-span-2 overflow-hidden hover:border-zinc-700 transition-all">
              <CardHeader className="bg-zinc-950/50 border-b border-zinc-800 py-4 px-6">
                <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-zinc-100">
                  <Laptop className="w-4 h-4 text-primary" />
                  {t("Infrastructure & Facility Compliance")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <Info label={t("Computers")} value={String(center.infrastructure?.computers ?? "—")} />
                <Info label={t("Classrooms")} value={String(center.infrastructure?.classrooms ?? "—")} />
                <Info label={t("Staff Members")} value={String(center.infrastructure?.staff ?? "—")} />
                <Info label={t("Lab Type")} value={t(center.infrastructure?.lab_type || "—")} />
                <Info label={t("High-Speed Internet")} value={center.infrastructure?.internet_available === undefined ? "—" : center.infrastructure.internet_available ? t("Yes") : t("No")} />
                <Info label={t("Power Backup")} value={center.infrastructure?.power_backup === undefined ? "—" : center.infrastructure.power_backup ? t("Yes") : t("No")} />
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-zinc-800 bg-zinc-900/90 shadow-xl backdrop-blur-xl overflow-hidden hover:border-zinc-700 transition-all">
              <CardHeader className="bg-zinc-950/50 border-b border-zinc-800 py-4 px-6">
                <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-zinc-100">
                  <School className="w-4 h-4 text-primary" />
                  {t("Allotted Courses")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {allottedCourseNames.length ? (
                  <ul className="space-y-2 text-sm font-semibold text-zinc-200">
                    {allottedCourseNames.map((c) => (
                      <li key={c} className="flex items-center gap-2 bg-zinc-950/60 border border-zinc-800 rounded-xl px-3 py-2 text-xs">
                        <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                        {t(c)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-zinc-400 font-medium">{t("No courses allotted.")}</div>
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
  <div className="border border-zinc-800 p-4 rounded-xl bg-zinc-950/40">
    <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{label}</div>
    <div className="text-lg font-black text-zinc-100 mt-1">{value}</div>
  </div>
);

export default CenterProfilePage;

