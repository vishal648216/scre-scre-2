import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  BadgeCheck,
  Clock,
  MapPin,
  Star,
  User,
} from "lucide-react";

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
  branding_media?: { center_logo_url?: string; banner_image_url?: string; gallery_urls?: string[]; qr_code_1_url?: string; qr_code_2_url?: string; short_clip_url?: string; short_clip_urls?: string[] };
  working_hours?: { opening_time?: string; closing_time?: string; working_days?: string[] };
  active: boolean;
};

const getYouTubeEmbedUrl = (url: string) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
};

const CenterPublicDetailsPage = () => {
  const { code } = useParams<{ code: string }>();
  const [center, setCenter] = useState<PublicCenter | null>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const getCourseName = (courseIdOrName: string) => {
    const course = courses.find(c => (c._id || c.id) === courseIdOrName || c.course_name === courseIdOrName);
    if (course) return course.course_name;
    return courseIdOrName;
  };

  const { mapSrc, isEmbed } = useMemo(() => {
    const v = (center?.location?.maps_embed_url || "").trim();
    if (!v) return { mapSrc: null, isEmbed: false };
    let url = v;
    if (v.includes("<iframe")) {
      const match = v.match(/src\s*=\s*["']([^"']+)["']/i);
      url = match?.[1]?.trim() || v;
    }
    // Check if it's a valid embed URL
    const isEmbed = url.includes("google.com/maps/embed") || url.includes("google.co.in/maps/embed");
    return { mapSrc: url, isEmbed };
  }, [center?.location?.maps_embed_url]);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/public/centers/${encodeURIComponent(code)}`).then(async (r) => {
        if (!r.ok) return null;
        const data = await r.json();
        return data?.data as PublicCenter | null;
      }),
      fetch("/api/public/courses").then(async (r) => {
        if (!r.ok) return [];
        const data = await r.json();
        return Array.isArray(data) ? data : [];
      })
    ])
      .then(([centerData, coursesData]) => {
        console.log("centerData:", centerData);
        console.log("centerData.course_allotment:", centerData?.course_allotment);
        console.log("coursesData:", coursesData);
        coursesData?.forEach((course, idx) => {
          console.log(`course ${idx}: id=${course.id}, course_name=${course.course_name}, _id=${course._id}`);
        });
        setCenter(centerData);
        setCourses(coursesData || []);
      })
      .catch(() => {
        setCenter(null);
        setCourses([]);
      })
      .finally(() => setLoading(false));
  }, [code]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <section className="container mx-auto px-4 py-12">
        <Link to="/centers" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary">
          <ArrowLeft className="w-4 h-4" /> Back to Centers
        </Link>

        {loading ? (
          <div className="mt-10 text-sm text-muted-foreground">Loading…</div>
        ) : !center ? (
          <div className="mt-10">
            <h1 className="text-2xl font-extrabold">Center not found</h1>
            <p className="text-muted-foreground mt-2">This center may be inactive or the code is incorrect.</p>
          </div>
        ) : (
          <div className="mt-8 space-y-10">
            {/* Top header */}
            <div className={cn(
              "bg-card border border-border rounded-3xl overflow-hidden relative min-h-[200px] flex items-center transition-all duration-500",
              center.branding_media?.banner_image_url ? "text-white border-transparent shadow-xl" : "text-foreground"
            )}>
              {center.branding_media?.banner_image_url && (
                <div
                  className="absolute inset-0 z-0 after:content-[''] after:absolute after:inset-0 after:bg-black/40"
                  style={{
                    backgroundImage: `url(${center.branding_media.banner_image_url})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                />
              )}
              <div className="p-8 md:p-10 relative z-10 w-full">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                  <div>
                    <div className={cn(
                      "text-xs font-black uppercase tracking-widest",
                      center.branding_media?.banner_image_url ? "text-white/80" : "text-muted-foreground"
                    )}>
                      {center.city}, {center.state} {center.location?.pincode ? `| Code: ${center.code}` : `| Code: ${center.code}`}
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      {center.branding_media?.center_logo_url && (
                        <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-2xl p-2 shadow-lg flex-shrink-0">
                          <img src={center.branding_media.center_logo_url} className="w-full h-full object-contain" alt="Logo" />
                        </div>
                      )}
                      <h1 className="text-3xl md:text-4xl font-extrabold drop-shadow-sm">{center.name}</h1>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <div className={cn(
                        "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-bold backdrop-blur-sm",
                        center.branding_media?.banner_image_url ? "bg-white/10 border-white/20 text-white" : "bg-muted/30 border-border text-foreground"
                      )}>
                        <Star className="w-4 h-4 text-amber-400" />
                        4.8
                      </div>
                      <div className={cn(
                        "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-bold backdrop-blur-sm",
                        center.branding_media?.banner_image_url ? "bg-white/10 border-white/20 text-white" : "bg-muted/30 border-border text-foreground"
                      )}>
                        <BadgeCheck className={cn("w-4 h-4", center.branding_media?.banner_image_url ? "text-emerald-400" : "text-emerald-600")} />
                        Center
                      </div>
                      <div className={cn(
                        "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-bold backdrop-blur-sm",
                        center.branding_media?.banner_image_url ? "bg-white/10 border-white/20 text-white" : "bg-muted/30 border-border text-foreground"
                      )}>
                        <MapPin className={cn("w-4 h-4", center.branding_media?.banner_image_url ? "text-white" : "text-accent")} />
                        {center.city}, {center.state}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              <div className="lg:col-span-2 space-y-8">
                <Section title="Overview">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Info icon={User} label="Center Director" value={center.owner_name || "—"} />
                    <Info
                      icon={Clock}
                      label="Working Days"
                      value={(center.working_hours?.working_days || []).join(", ") || "—"}
                    />
                  </div>
                </Section>

                <Section title="About Center">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {center.about_center ||
                      `${center.name} is a training institute located in ${center.city}. This center is equipped with facilities to support skill development and student learning.`}
                  </p>
                </Section>

                <Section title="Infrastructure & Facilities">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <MiniStat label="Computers" value={`${center.infrastructure?.computers ?? "—"} Systems`} />
                    <MiniStat label="Classrooms" value={`${center.infrastructure?.classrooms ?? "—"} Rooms`} />
                    <MiniStat label="Staff" value={`${center.infrastructure?.staff ?? "—"} Members`} />
                    <MiniStat label="Internet" value={center.infrastructure?.internet_available === undefined ? "—" : center.infrastructure.internet_available ? "Yes" : "No"} />
                    <MiniStat label="Power Backup" value={center.infrastructure?.power_backup === undefined ? "—" : center.infrastructure.power_backup ? "Yes" : "No"} />
                    <MiniStat label="Lab Type" value={center.infrastructure?.lab_type || "—"} />
                  </div>
                </Section>

                <Section title="Center Gallery">
                  {center.branding_media?.gallery_urls?.length ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {center.branding_media.gallery_urls.slice(0, 12).map((u) => (
                        <a
                          key={u}
                          href={u}
                          target="_blank"
                          rel="noreferrer"
                          className="block border border-border rounded-2xl overflow-hidden hover:opacity-90 transition-opacity"
                        >
                          <img
                            src={u}
                            alt="Gallery"
                            className="w-full h-28 object-cover"
                            onError={(e) => {
                              // If image fails, show a placeholder or hide
                              const target = e.target as HTMLImageElement;
                              target.src = "https://placehold.co/600x400?text=No+Image";
                              target.onerror = null; // prevent loop
                            }}
                          />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">No gallery images uploaded.</div>
                  )}
                </Section>
              </div>

              <aside className="space-y-6">
                {(() => {
                  const clips = center.branding_media?.short_clip_urls || [];
                  const singleClip = center.branding_media?.short_clip_url;
                  const allClips = [...(singleClip ? [singleClip] : []), ...clips];

                  if (allClips.length > 0) {
                    return (
                      <Section title="Center Clips">
                        <div className="space-y-4">
                          {allClips.map((clip, idx) => {
                            const youtubeEmbed = getYouTubeEmbedUrl(clip);
                            return (
                              <div key={idx} className="aspect-video w-full rounded-2xl overflow-hidden border border-border shadow-md">
                                {youtubeEmbed ? (
                                  <iframe
                                    src={youtubeEmbed}
                                    className="w-full h-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    title={`Center Clip ${idx + 1}`}
                                  />
                                ) : (
                                  <video
                                    src={clip}
                                    className="w-full h-full object-cover"
                                    controls
                                    playsInline
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </Section>
                    );
                  }
                  return null;
                })()}

                <Section title="Contact Details">
                  <div className="space-y-3 text-sm">
                    <div className="text-muted-foreground">
                      <span className="font-bold text-foreground">Address:</span>
                      <div className="mt-1">{center.address}</div>
                      <div className="mt-1">{center.city}, {center.state}{center.location?.pincode ? ` - ${center.location.pincode}` : ""}</div>
                    </div>
                    <div>
                      <span className="font-bold text-foreground">Opening Hours:</span>{" "}
                      <span className="text-muted-foreground">
                        {center.working_hours?.opening_time || "—"} - {center.working_hours?.closing_time || "—"}
                      </span>
                    </div>
                  </div>
                </Section>

                <Section title="Courses Available">
                  {(center.course_allotment || []).length ? (
                    <div className="flex flex-col gap-2">
                      {(center.course_allotment || []).slice(0, 10).map((c) => {
                        const course = courses.find(course => (course._id || course.id) === c || course.course_name === c);
                        return (
                          <div key={c} className="border border-border rounded-xl px-4 py-2 text-sm font-bold">
                            {course?.course_name || c}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">No course allotment published yet.</div>
                  )}
                </Section>

                {mapSrc ? (
                  <Section title="Location & Map">
                    <div className="text-sm text-muted-foreground">
                      {center.location?.country || "—"} • {center.city}, {center.state}
                      {center.location?.pincode ? ` • ${center.location.pincode}` : ""}
                    </div>
                    <div className="mt-4 overflow-hidden rounded-2xl border border-border">
                      {isEmbed ? (
                        <iframe
                          src={mapSrc || ""}
                          className="w-full h-64"
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          title="Center Location"
                        />
                      ) : (
                        <div className="w-full h-64 bg-muted/30 flex flex-col items-center justify-center text-center p-6">
                          <MapPin className="w-8 h-8 text-muted-foreground mb-2" />
                          <p className="text-sm font-bold text-muted-foreground">Map preview unavailable</p>
                          <p className="text-xs text-muted-foreground mt-1">Please use the button below to view on Google Maps</p>
                        </div>
                      )}
                    </div>
                    <a
                      href={(() => {
                        if (mapSrc.includes("google.com/maps/embed")) {
                          const queryParams = new URLSearchParams(mapSrc.split("?")[1] || "");
                          const pbParam = queryParams.get("pb");
                          if (pbParam) {
                            return `https://www.google.com/maps?q=${pbParam}`;
                          }
                          const qParam = queryParams.get("q");
                          if (qParam) {
                            return `https://www.google.com/maps?q=${qParam}`;
                          }
                          return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(center.city + ", " + center.state + " " + (center.location?.pincode || ""))}`;
                        }
                        return mapSrc;
                      })()}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center justify-center rounded-xl bg-muted border border-border px-4 py-3 text-sm font-extrabold hover:border-primary transition w-full"
                    >
                      Open in Google Maps
                    </a>
                  </Section>
                ) : null}
              </aside>
            </div>
          </div>
        )}
      </section>
      <Footer />
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-card border border-border rounded-3xl p-8">
    <h2 className="text-xl font-extrabold text-foreground">{title}</h2>
    <div className="mt-5">{children}</div>
  </div>
);

const Info = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="border border-border rounded-2xl p-4 flex items-start gap-3">
    <div className="w-10 h-10 bg-muted/40 flex items-center justify-center rounded-xl">
      <Icon className="w-5 h-5 text-primary" />
    </div>
    <div>
      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-sm font-extrabold text-foreground mt-1">{value}</div>
    </div>
  </div>
);

const MiniStat = ({ label, value }: { label: string; value: string }) => (
  <div className="border border-border rounded-2xl p-4">
    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</div>
    <div className="text-sm font-extrabold text-foreground mt-1">{value}</div>
  </div>
);

export default CenterPublicDetailsPage;

