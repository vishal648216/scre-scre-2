import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { stripHtml } from "@/lib/courseDisplay";
import { useTranslation } from "react-i18next";
import { Skeleton } from "./ui/skeleton";
import { normalizeAssetUrl } from "@/lib/utils";
import { getCategoryFallbackImage } from "@/lib/imageFallback";

/** Static fallback for Admission / inquiry forms when the API returns nothing. */
export const courses = [
  {
    slug: "dca",
    title: "DCA",
    subtitle: "Diploma in Computer Applications",
    duration: "6 Months",
    price: "₹8,500",
    image: "/images/icc-3.jpg",
    desc: "Fundamentals of computing, MS Office, Internet usage & basic programming concepts for beginners.",
  },
  {
    slug: "adca",
    title: "ADCA",
    subtitle: "Advanced Diploma",
    duration: "1 Year",
    price: "₹14,500",
    image: "/images/icc-2.jpg",
    desc: "Advanced computing, DTP, Tally & web technologies with practical projects and real-world applications.",
  },
  {
    slug: "tally-prime-gst",
    title: "Tally Prime",
    subtitle: "Accounting & GST",
    duration: "3 Months",
    price: "₹7,500",
    image: "/images/icc-1.jpg",
    desc: "Accounting, GST billing, inventory management and financial reporting using Tally Prime software.",
  },
  {
    slug: "web-designing",
    title: "Web Designing",
    subtitle: "Full Stack Development",
    duration: "6 Months",
    price: "₹18,000",
    image: "/images/icc-3.jpg",
    desc: "HTML, CSS, JavaScript and responsive design with live projects and modern development practices.",
  },
];

type CategoryRow = {
  id: string;
  _id?: string;
  name: string;
  description?: string;
  image_url?: string;
  imageUrl?: string;
  image?: string;
};

const CATEGORY_FALLBACK_IMAGE = "/images/icc-3.jpg";

function resolveCategoryImage(category: Partial<CategoryRow> | null | undefined): string {
  return (category?.image_url || category?.imageUrl || category?.image || "").trim();
}

interface CoursesSectionProps {
  data?: any[];
  categories?: any[];
  loading?: boolean;
}

const CoursesSection = () => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const startScrollLeft = useRef(0);
  const autoScrollInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const catsRes = await apiFetch("/api/public/categories");
        const catsData = catsRes.ok ? await catsRes.json() : { items: [] };
        if (cancelled) return;
        const safeItems = Array.isArray(catsData.items) ? catsData.items : [];
        const categoriesToSet = safeItems.map((category: CategoryRow) => ({
          ...category,
          image_url: resolveCategoryImage(category),
        }));
        setCategories(categoriesToSet);
      } catch (err) {
        console.error("CoursesSection: Error loading categories:", err);
        if (!cancelled) setCategories([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = 0;
    }
  }, [categories]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = 280;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!scrollRef.current) return;
    isDragging.current = true;

    // Pause auto-scroll
    if (autoScrollInterval.current) {
      clearInterval(autoScrollInterval.current);
      autoScrollInterval.current = null;
    }

    if ('touches' in e) {
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
    } else {
      startX.current = (e as React.MouseEvent).pageX - scrollRef.current.offsetLeft;
    }
    startScrollLeft.current = scrollRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging.current || !scrollRef.current) return;

    let currentX: number;
    if ('touches' in e) {
      currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const deltaX = Math.abs(currentX - startX.current);
      const deltaY = Math.abs(currentY - startY.current);
      if (deltaX > deltaY) {
        e.preventDefault();
        const walk = (currentX - startX.current) * 1.5;
        scrollRef.current.scrollLeft = startScrollLeft.current - walk;
      }
    } else {
      e.preventDefault();
      currentX = (e as React.MouseEvent).pageX - scrollRef.current.offsetLeft;
      const walk = (currentX - startX.current) * 1.5;
      scrollRef.current.scrollLeft = startScrollLeft.current - walk;
    }
  };

  const handleMouseUpOrLeave = () => {
    if (!isDragging.current) return;
    isDragging.current = false;

    // Resume auto-scroll
    startAutoScroll();
  };

  const startAutoScroll = () => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer || categories.length === 0) return;

    if (autoScrollInterval.current) {
      clearInterval(autoScrollInterval.current);
    }

    autoScrollInterval.current = setInterval(() => {
      if (isDragging.current) return;

      const scrollAmount = 280;
      const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;

      if (scrollContainer.scrollLeft >= maxScroll) {
        scrollContainer.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        scrollContainer.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    }, 3000);
  };

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer || categories.length === 0) return;

    // Start auto-scroll
    startAutoScroll();

    const handleMouseEnter = () => {
      if (autoScrollInterval.current) {
        clearInterval(autoScrollInterval.current);
        autoScrollInterval.current = null;
      }
    };

    const handleMouseLeave = () => {
      if (!isDragging.current) {
        startAutoScroll();
      }
    };

    scrollContainer.addEventListener("mouseenter", handleMouseEnter);
    scrollContainer.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      if (autoScrollInterval.current) {
        clearInterval(autoScrollInterval.current);
      }
      if (scrollContainer) {
        scrollContainer.removeEventListener("mouseenter", handleMouseEnter);
        scrollContainer.removeEventListener("mouseleave", handleMouseLeave);
      }
    };
  }, [categories]);

  return (
    <section id="courses" className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="max-w-2xl">
            <span className="inline-block bg-primary/10 text-primary font-heading font-bold text-xs uppercase tracking-widest px-4 py-1.5 rounded-full mb-4">
              {t("Explore Categories")}
            </span>
            <h2 className="text-3xl md:text-5xl font-extrabold text-foreground leading-tight">
              {t("Choose Your Field")} <br />
              <span className="text-primary">{t("Of Study")}</span>
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => scroll("left")}
              className="w-12 h-12 rounded-full border border-border bg-card flex items-center justify-center text-foreground hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm"
              aria-label={t("Previous categories")}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => scroll("right")}
              className="w-12 h-12 rounded-full border border-border bg-card flex items-center justify-center text-foreground hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm"
              aria-label={t("Next categories")}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Container Wrapper with Gradient Fades */}
        <div className="relative group/scroll">
          {/* Left Gradient Fade */}
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-muted/30 to-transparent z-20 pointer-events-none opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-500" />

          {/* Right Gradient Fade */}
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-muted/30 to-transparent z-20 pointer-events-none opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-500" />

          {/* Scrollable Container */}
          <div
            ref={scrollRef}
            className="flex overflow-x-auto flex-nowrap gap-8 pb-6 snap-x px-4 -mx-4 scroll-smooth select-none"
            style={{ cursor: isDragging.current ? 'grabbing' : 'grab' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUpOrLeave}
          >
            {loading ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="min-w-[280px] md:min-w-[320px] snap-start flex-shrink-0">
                  <Skeleton className="h-[350px] w-full rounded-[2rem]" />
                </div>
              ))
            ) : categories.length === 0 ? (
              <div className="min-w-[280px] py-16 text-muted-foreground text-sm mx-auto">
                {t("No categories published yet. Add categories in the admin dashboard.")}
              </div>
            ) : (
              categories.map((category) => (
                <div
                  key={category.id || category._id}
                  className="min-w-[280px] md:min-w-[320px] group snap-start flex-shrink-0"
                >
                  <div className="bg-card border border-border rounded-[2rem] overflow-hidden hover-popup-subtle h-full flex flex-col relative shadow-sm hover:shadow-xl transition-all duration-500 max-w-[320px] mx-auto">
                    {/* Image wrapper */}
                    <Link
                      to={`/courses?category=${category.id || category._id}`}
                      className="relative h-44 overflow-hidden block"
                    >
                      <img
                        src={normalizeAssetUrl(resolveCategoryImage(category)) || getCategoryFallbackImage(category.name)}
                        alt={category.name}
                        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (!target.dataset.fallbackApplied) {
                            target.dataset.fallbackApplied = "true";
                            target.src = getCategoryFallbackImage(category.name);
                          }
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60" />
                    </Link>

                    {/* Content */}
                    <div className="p-5 flex flex-col flex-grow">
                      <h3 className="text-lg font-black text-foreground mb-2 line-clamp-1 group-hover:text-primary transition-colors duration-300 tracking-tight">
                        {t(category.name)}
                      </h3>

                      <p className="text-muted-foreground text-[11px] leading-snug mb-4 line-clamp-3 opacity-80">
                        {t(stripHtml(category.description || "Explore courses in this category."))}
                      </p>

                      <div className="mt-auto pt-3 border-t border-border/50 flex items-center justify-between">
                        <Link
                          to={`/courses?category=${category.id || category._id}`}
                          className="text-primary font-black text-[8px] uppercase tracking-[0.2em] flex items-center gap-1.5 group/btn relative z-10 hover:text-primary-dark transition-colors"
                        >
                          {t("View Courses")}
                          <ArrowRight size={10} className="transition-transform group-hover/btn:translate-x-1 duration-300" />
                        </Link>

                        <Link
                          to="/admission"
                          className="bg-primary/10 text-primary hover:bg-primary hover:text-white px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all relative z-10"
                        >
                          {t("Enquire")}
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* View All Button */}
        <div className="text-center mt-12">
          <Link
            to="/courses"
            className="inline-flex items-center gap-3 bg-foreground text-background px-10 py-4 rounded-2xl font-bold hover-popup shadow-lg"
          >
            {t("View All Courses")}
            <ArrowRight size={20} />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default CoursesSection;
