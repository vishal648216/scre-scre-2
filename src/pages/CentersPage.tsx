import { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { MapPin, Search, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { normalizeAssetUrl } from "@/lib/utils";

type PublicCenter = {
  _id?: string;
  name: string;
  code: string;
  owner_name: string;
  about_center?: string;
  address: string;
  city: string;
  state: string;
  location?: { country?: string; pincode?: string; maps_embed_url?: string };
  infrastructure?: { computers?: number; classrooms?: number; staff?: number; internet_available?: boolean; power_backup?: boolean; lab_type?: string };
  course_allotment?: string[];
  branding_media?: { center_logo_url?: string; banner_image_url?: string; gallery_urls?: string[] };
  working_hours?: { opening_time?: string; closing_time?: string; working_days?: string[] };
  active: boolean;
};

const CentersPage = () => {
  const { t } = useTranslation();
  const [centers, setCenters] = useState<PublicCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [visibleCount, setVisibleCount] = useState(4);

  useEffect(() => {
    setLoading(true);
    fetch("/api/public/centers")
      .then((r) => r.json())
      .then((d) => setCenters(Array.isArray(d?.data) ? d.data : []))
      .catch(() => setCenters([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return centers;
    return centers.filter((c) =>
      [c.name, c.code, c.city, c.state, c.address, c.location?.pincode, c.location?.country]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [centers, q]);

  useEffect(() => {
    // Reset pagination when searching/clearing
    setVisibleCount(4);
  }, [q]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <section className="container mx-auto px-4 py-14">
        <div className="max-w-4xl">
          <h1 className="text-4xl font-extrabold text-foreground">{t("Find Your Center")}</h1>
          <p className="mt-2 text-muted-foreground">
            {t("Search by center name, code, city, state, or pincode and open the full center profile.")}
          </p>
          <div className="mt-6 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-card"
              placeholder={t("Search by name / code / city / pincode...")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-10">
          {loading ? (
            <div className="text-sm text-muted-foreground">{t("Loading centers…")}</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t("No centers found.")}</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.slice(0, visibleCount).map((c) => (
                <div key={c.code} className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
                  {c.branding_media?.banner_image_url ? (
                    <img
                      src={normalizeAssetUrl(c.branding_media.banner_image_url) || "/images/icc-1.jpg"}
                      alt={c.name}
                      className="w-full h-36 object-cover"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (!target.dataset.fallbackApplied) {
                          target.dataset.fallbackApplied = "true";
                          target.src = "/images/icc-1.jpg";
                        }
                      }}
                    />
                  ) : (
                    <div className="w-full h-36 bg-muted/40" />
                  )}
                  <div className="p-6 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                          {t("Code")}: {c.code}
                        </div>
                        <div className="text-lg font-extrabold text-foreground leading-tight">{t(c.name)}</div>
                      </div>
                      <div className="inline-flex items-center gap-1 px-2 py-1 border border-emerald-500/20 bg-emerald-500/5 text-emerald-600 text-[10px] font-black uppercase tracking-widest">
                        <ShieldCheck className="w-3 h-3" />
                        {t("Active")}
                      </div>
                    </div>

                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-accent" />
                      <span>
                        {t(c.city)}, {t(c.state)} {c.location?.pincode ? `• ${c.location.pincode}` : ""}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {t(c.address)}
                    </div>

                    <div className="pt-2 flex items-center justify-between gap-3">
                      <Link
                        to={`/centers/${encodeURIComponent(c.code)}`}
                        className="inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-bold hover:opacity-90 transition"
                      >
                        {t("View Center")}
                      </Link>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t("Courses")}: {c.course_allotment?.length || 0}
                      </div>
                    </div>
                  </div>
                </div>
                ))}
              </div>

              {filtered.length > visibleCount ? (
                <div className="mt-8 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((v) => v + 6)}
                    className="rounded-xl border border-border bg-card px-6 py-3 text-sm font-extrabold hover:border-primary transition"
                  >
                    {t("Show more")}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default CentersPage;

