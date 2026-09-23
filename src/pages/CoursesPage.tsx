import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Header from "@/components/Header";
import { usePublicSystemSettings } from "@/hooks/usePublicSystemSettings";
import { apiFetch } from "@/lib/api";
import { useEffect } from "react";
import {
  Search,
  Clock,
  IndianRupee,
  ArrowRight,
  SlidersHorizontal,
  X,
  Sparkles,
  Filter,
} from "lucide-react";
import { cn, normalizeAssetUrl } from "@/lib/utils";
import Footer from "@/components/Footer";
import { courseTypeLabel, formatCourseDuration, stripHtml } from "@/lib/courseDisplay";

const priceToNumber = (price?: number) => {
  if (price === undefined || price === null) return null;
  return price > 0 ? price : null;
};

interface Course {
  id: string;
  _id?: string;
  category_id: string;
  course_name: string;
  course_code: string;
  course_type?: string;
  duration_months: number;
  duration_value?: number;
  duration_unit?: string;
  description?: string;
  image_url?: string;
  og_image_url?: string;
  syllabus?: string;
  fees?: number;
  registration_fee?: number;
  exam_fees_applicable?: boolean;
  exam_fee_amount?: number;
  backlog_fees_applicable?: boolean;
  backlog_fee_amount?: number;
  has_course_structure_units?: boolean;
  eligibility?: string;
  status: string;
  created_at: string;
  __categoryName?: string;
}

const CoursesPage = () => {
  const { t } = useTranslation();
  const { data: settings } = usePublicSystemSettings();
  const [searchParams] = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<{ id: string; _id?: string; name: string; image_url?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<
    "recommended" | "priceLow" | "priceHigh" | "duration"
  >("recommended");
  const [activeCategoryId, setActiveCategoryId] = useState<string>("all");
  const [showAllCategories, setShowAllCategories] = useState<boolean>(false);

  useEffect(() => {
    const categoryParam = searchParams.get("category");
    if (categoryParam) {
      setActiveCategoryId(categoryParam);
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const lang = (localStorage.getItem("lang") || document.documentElement.getAttribute("lang") || "en").split("-")[0];
        const [coursesRes, catsRes] = await Promise.all([
          apiFetch(`/api/public/courses?lang=${lang}`),
          apiFetch(`/api/public/categories?lang=${lang}`),
        ]);

        const coursesData = await coursesRes.json();
        const catsData = await catsRes.json();

        if (coursesRes.ok) setCourses(coursesData);
        if (catsRes.ok) {
          setCategories(catsData.items || []);
        } else {
          // Public fallback when admin endpoint is protected.
          const categoryMap = new Map<string, { id: string; _id?: string; name: string }>();
          (coursesData || []).forEach((c: any) => {
            if (c?.category_id && c?.category_name) {
              categoryMap.set(String(c.category_id), {
                id: String(c.category_id),
                _id: String(c.category_id),
                name: String(c.category_name),
              });
            }
          });
          setCategories(Array.from(categoryMap.values()));
        }
      } catch (error) {
        console.error("Failed to fetch data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getCategoryName = (id: string) => categories.find(c => (c.id === id || c._id === id))?.name || "Course";

  const enriched = useMemo(() => {
    return courses.map((c, idx) => {
      const catName = getCategoryName(c.category_id);
      const text = `${c.course_name} ${stripHtml(c.description)} ${catName} ${courseTypeLabel(c.course_type)}`.toLowerCase();
      const p = priceToNumber(c.fees);

      const durationScore = (d?: number) => {
        if (!d) return 999;
        return d;
      };

      // "recommended" keeps original order from your data
      return {
        ...c,
        __idx: idx,
        __text: text,
        __priceNum: p,
        __categoryName: catName,
        __durationScore: durationScore(c.duration_months),
      };
    });
  }, [courses, categories]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    let list = enriched.filter((c) => {
      const matchQuery = q ? c.__text.includes(q) : true;
      const matchTag = activeCategoryId === "all" ? true : (c.category_id === activeCategoryId);
      return matchQuery && matchTag;
    });

    if (sortBy === "priceLow") {
      list = [...list].sort((a, b) => {
        const ap = a.__priceNum ?? Number.POSITIVE_INFINITY;
        const bp = b.__priceNum ?? Number.POSITIVE_INFINITY;
        return ap - bp;
      });
    } else if (sortBy === "priceHigh") {
      list = [...list].sort((a, b) => {
        const ap = a.__priceNum ?? -1;
        const bp = b.__priceNum ?? -1;
        return bp - ap;
      });
    } else if (sortBy === "duration") {
      list = [...list].sort((a, b) => a.__durationScore - b.__durationScore);
    } else {
      list = [...list].sort((a, b) => a.__idx - b.__idx);
    }

    return list;
  }, [enriched, query, activeCategoryId, sortBy]);

  const count = filtered.length;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* ================== HERO (PREMIUM) ================== */}
      <section className="relative overflow-hidden border-b border-border">
        {/* Decorative */}
        <div className="absolute -top-24 -right-24 w-[520px] h-[520px] bg-accent/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-28 -left-28 w-[520px] h-[520px] bg-primary/12 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 py-14 md:py-16 relative">
          <div className="grid lg:grid-cols-[1.25fr_0.75fr] gap-10 items-start">
            {/* LEFT */}
            <div className="bg-card/70 backdrop-blur-md border border-border rounded-[28px] p-7 md:p-10 shadow-xl relative overflow-hidden">
              <div className="absolute inset-0 opacity-[0.06] pointer-events-none">
                <div className="absolute top-0 right-0 w-72 h-72 bg-secondary rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-72 h-72 bg-accent rounded-full blur-3xl" />
              </div>

              <div className="relative">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-4 py-1.5 text-xs font-black uppercase tracking-[0.22em]">
                    <Sparkles className="w-4 h-4" />
                    {t("Programs & Certifications")}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-secondary/10 text-secondary px-4 py-1.5 text-xs font-black uppercase tracking-[0.22em]">
                    {t("Placement Support")}
                  </span>
                </div>

                <h1 className="mt-7 font-heading font-extrabold text-3xl md:text-5xl text-foreground leading-[1.05]">
                  {t("Choose a course that turns")} <span className="text-primary">{t("learning")}</span> {t("into")} <span className="text-accent">{t("results")}</span>.
                </h1>

                <p className="mt-6 text-muted-foreground text-base md:text-lg leading-relaxed max-w-2xl">
                  {t("Explore industry-aligned programs in computer applications, web development, accounting, design and communication—built for practical skills and job readiness.")}
                </p>

                {/* Quick actions row */}
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <Link
                    to="/admission"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-7 py-4 text-sm font-extrabold text-primary-foreground shadow-lg hover:bg-primary-dark transition"
                  >
                    {t("Apply for Admission")} <ArrowRight className="w-4 h-4" />
                  </Link>
                  <a
                    href={`tel:${(settings?.contact_phone as string) || "+919466317100"}`}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-background/60 border border-border px-7 py-4 text-sm font-extrabold text-foreground hover:border-primary/50 transition"
                  >
                    {t("Talk to Counselor")}
                  </a>
                </div>

                {/* Stats strip */}
                <div className="mt-8 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-border bg-background/60 p-4">
                    <div className="text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground">
                      {t("Courses")}
                    </div>
                    <div className="mt-1 text-xl font-extrabold text-foreground">
                      {courses.length}+
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/60 p-4">
                    <div className="text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground">
                      {t("Mode")}
                    </div>
                    <div className="mt-1 text-xl font-extrabold text-foreground">
                      {t("Practical")}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/60 p-4">
                    <div className="text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground">
                      {t("Support")}
                    </div>
                    <div className="mt-1 text-xl font-extrabold text-foreground">
                      {t("Placement")}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT - FILTER CONSOLE */}
            <aside className="bg-card border border-border rounded-[28px] p-6 md:p-7 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="text-sm font-extrabold text-foreground flex items-center gap-2">
                  <Filter className="w-4 h-4 text-primary" />
                  {t("Search & Filter")}
                </div>
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground">
                  {count} {t("results")}
                </div>
              </div>

              {/* Search */}
              <div className="mt-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("Search courses...")}
                  className={cn(
                    "w-full pl-10 pr-10 py-3 rounded-2xl border border-border bg-muted/30",
                    "text-sm font-semibold focus:border-primary focus:outline-none transition-all"
                  )}
                />
                {query?.length > 0 && (
                  <button
                    onClick={() => setQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                    aria-label={t("Clear search")}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Tags */}
              <div className="mt-5">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground">
                  {t("Categories")}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => setActiveCategoryId("all")}
                    className={cn(
                      "px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-[0.18em] border transition",
                      activeCategoryId === "all"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-border hover:border-primary/50"
                    )}
                  >
                    {t("All")}
                  </button>
                  {(showAllCategories ? categories : categories.slice(0, 10)).map((cat) => (
                    <button
                      key={cat._id || cat.id}
                      onClick={() => setActiveCategoryId(cat._id || cat.id)}
                      className={cn(
                        "px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-[0.18em] border transition",
                        (cat._id || cat.id) === activeCategoryId
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-foreground border-border hover:border-primary/50"
                      )}
                    >
                      {t(cat.name)}
                    </button>
                  ))}
                  {categories.length > 10 && (
                    <button
                      onClick={() => setShowAllCategories(!showAllCategories)}
                      className="px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-[0.18em] border border-primary/50 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition"
                    >
                      {showAllCategories ? t("Less") : t("More")}
                    </button>
                  )}
                </div>
              </div>

              {/* Sort By */}
              <div className="mt-5">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground">
                  {t("Sort By")}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-xl bg-muted/30 border border-border px-3 py-2 text-xs font-bold text-muted-foreground">
                    <SlidersHorizontal className="w-4 h-4" />
                    {t("Sort")}
                  </div>
                  <select
                    value={sortBy}
                    onChange={(e) =>
                      setSortBy(e.target.value as typeof sortBy)
                    }
                    className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:border-primary transition"
                  >
                    <option value="recommended">{t("Recommended")}</option>
                    <option value="priceLow">{t("Price: Low to High")}</option>
                    <option value="priceHigh">{t("Price: High to Low")}</option>
                    <option value="duration">{t("Duration")}</option>
                  </select>
                </div>
              </div>

              {/* Reset */}
              <button
                onClick={() => {
                  setQuery("");
                  setActiveCategoryId("all");
                  setSortBy("recommended");
                }}
                className="mt-6 w-full rounded-2xl bg-accent text-accent-foreground py-3.5 text-sm font-extrabold hover:bg-accent-dark transition"
              >
                {t("Reset Filters")}
              </button>

              {/* <div className="mt-4 text-xs text-muted-foreground leading-relaxed">
                Tip: Try searching “GST”, “Web”, “Design” or “English”.
              </div> */}
            </aside>
          </div>
        </div>
      </section>

      {/* ================== RESULTS (PRO GRID) ================== */}
      <section className="container mx-auto px-4 py-12">
        {/* Results header row */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground">
              {t("Available Programs")}
            </div>
            <h2 className="mt-2 text-3xl md:text-4xl font-extrabold text-foreground">
              {t("Explore Courses")}
            </h2>
            <p className="mt-2 text-muted-foreground max-w-2xl">
              {t("Designed with structured learning, practical exposure and clear outcomes.")}
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-5 py-3 shadow-sm">
            <span className="text-xs font-black uppercase tracking-[0.22em] text-muted-foreground">
              {t("Showing")}
            </span>
            <span className="text-sm font-extrabold text-foreground">
              {count}
            </span>
            <span className="text-xs font-black uppercase tracking-[0.22em] text-muted-foreground">
              {t("courses")}
            </span>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-3xl p-10 text-center shadow-sm max-w-2xl mx-auto">
            <div className="text-2xl font-extrabold text-foreground">
              {t("No courses found")}
            </div>
            <p className="text-muted-foreground mt-2">
              {t("Try a different keyword or switch category.")}
            </p>
            <button
              onClick={() => {
                setQuery("");
                setActiveCategoryId("all");
                setSortBy("recommended");
              }}
              className="mt-6 inline-flex items-center justify-center rounded-2xl bg-primary px-7 py-3 text-sm font-extrabold text-primary-foreground hover:bg-primary-dark transition"
            >
              {t("Reset Filters")}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center">
            {filtered.map((course) => (
              <article
                key={course._id || course.id}
                className={cn(
                  "group rounded-[28px] border border-border bg-card overflow-hidden relative w-full",
                  "shadow-sm hover:shadow-2xl transition-all duration-300",
                  "max-w-sm mx-auto"
                )}
              >
                {/* Media */}
                <div className="relative h-52 overflow-hidden">
                  {(() => {
                    console.log("CoursesPage.tsx - course:", course);
                    console.log("CoursesPage.tsx - course.image_url:", course.image_url);
                    const normalizedUrl = normalizeAssetUrl(course.image_url);
                    console.log("CoursesPage.tsx - normalizedUrl:", normalizedUrl);
                    return (course.image_url && normalizedUrl) ? (
                      <>
                        <img
                          src={normalizedUrl}
                          alt={course.course_name}
                          className="w-full h-full object-cover transition duration-700 group-hover:scale-110"
                          onError={(e) => {
                            console.log("CoursesPage.tsx - Image failed to load:", normalizedUrl);
                            (e.target as HTMLImageElement).src = "/images/icc-3.jpg";
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-primary/55 via-primary/10 to-transparent" />
                      </>
                    ) : (
                      <div className="w-full h-full bg-muted/40 flex items-center justify-center">
                        <img
                          src="/images/icc-3.jpg"
                          alt={course.course_name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    );
                  })()}



                  {/* Bottom highlight line */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-accent via-secondary to-primary" />
                </div>

                {/* Body */}
                <div className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="text-xl font-extrabold text-foreground leading-tight">
                        {course.course_name}
                      </h3>
                      <p className="mt-1 text-[11px] font-black uppercase tracking-[0.18em] text-secondary">
                        {course.__categoryName} · {courseTypeLabel(course.course_type)}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 text-accent px-4 py-1.5 text-[12px] font-black shadow-sm border border-accent/20">
                        <IndianRupee className="w-3.5 h-3.5" />
                        {course.fees != null && course.fees > 0 ? course.fees.toLocaleString("en-IN") : "—"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-4 py-2 text-xs font-bold">
                      <Clock className="w-4 h-4" />
                      {formatCourseDuration(course)}
                    </div>

                    {/* <div className="text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground">
                      Job Ready
                    </div> */}
                  </div>

                  <p className="mt-4 text-sm text-muted-foreground leading-relaxed line-clamp-3">
                    {stripHtml(course.description) || "View full details and fee structure on the course page."}
                  </p>

                  {/* Actions */}
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <Link
                      to={`/courses/${course._id || course.id}`}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground px-4 py-3 text-sm font-extrabold hover:bg-primary-dark transition before:absolute before:inset-0 before:z-0"
                    >
                      {t("Details")} <ArrowRight className="w-4 h-4" />
                    </Link>
                    <Link
                      to={`/courses/${course._id || course.id}`}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-background border border-border px-4 py-3 text-sm font-extrabold text-foreground hover:border-accent/60 hover:bg-accent/10 transition relative z-10"
                    >
                      {t("Enquire")} <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ================= CTA STRIP (KEEPING YOUR GOOD ONE) ================= */}
      <section className="border-t border-border bg-background">
        <div className="container mx-auto px-4 py-14">
          <div className="bg-primary text-primary-foreground rounded-3xl p-10 md:p-12 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-accent/25 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />

            <div className="relative grid md:grid-cols-2 gap-10 items-center">
              <div>
                <p className="text-accent text-xs font-bold uppercase tracking-[0.25em]">
                  Need help choosing?
                </p>
                <h3 className="mt-4 text-3xl md:text-4xl font-extrabold leading-tight">
                  Get guidance from our counselors
                </h3>
                <p className="mt-4 text-primary-foreground/85 leading-relaxed">
                  Tell us your goal and we’ll suggest the best course path for you.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 md:justify-end">
                <Link
                  to="/admission"
                  className="inline-flex items-center justify-center rounded-xl bg-accent text-accent-foreground px-8 py-4 font-bold hover:bg-accent-dark transition"
                >
                  Apply for Admission
                </Link>
                <a
                  href={`tel:${(settings?.contact_phone as string) || "+919466317100"}`}
                  className="inline-flex items-center justify-center rounded-xl bg-background/10 border border-primary-foreground/20 px-8 py-4 font-bold hover:bg-background/15 transition"
                >
                  Call Now: {(settings?.contact_phone as string) || "+91 9466317100"}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default CoursesPage;