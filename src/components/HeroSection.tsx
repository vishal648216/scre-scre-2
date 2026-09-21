import { useState, useEffect, useRef } from "react";
import {
  GraduationCap,
  Award,
  Users,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useHomeData } from "@/hooks/useHomeData";
import { useTranslation } from "react-i18next";

const defaultSlides = [
  {
    tag: "🎓 Admissions Open 2026",
    heading: "Build Your Future with",
    highlight: "IT & Skill Education",
    desc: "Empowering students with industry-ready skills through certified computer courses and vocational training programs.",
    image: "/images/icc-1.jpg",
    mobile_image: null,
    link: "#",
    buttonText: "Apply Now — It's Free",
    viewCoursesButtonText: "View Courses",
    viewCoursesButtonLink: "#courses",
    showStats: false,
    stat1Text: "Certified Courses",
    stat2Text: "Industry Recognized",
    stat3Text: "5000+ Alumni",
    stat4Text: "100% Placement"
  },
];

const HeroSection = () => {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(0);
  const { data: homeData, isLoading } = useHomeData();
  const [maxSlideHeight, setMaxSlideHeight] = useState<number | null>(null);
  const [imagesLoaded, setImagesLoaded] = useState<Record<string, boolean>>({});
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  const cmsArray = Array.isArray(homeData?.cms) ? homeData.cms : [];

  const safeCmsArray = Array.isArray(cmsArray) ? cmsArray : [];

  const slides = safeCmsArray
    .filter((item: any) => item.category === "slider" && item.active)
    .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
    .map((item: any) => ({
      tag: item.tag ? t(item.tag) : "",
      heading: item.title ? t(item.title) : "",
      highlight: item.highlight ? t(item.highlight) : "",
      desc: item.description ? t(item.description) : "",
      image: item.image_url,
      mobile_image: item.mobile_image_url,
      link: item.link,
      button_text: item.button_text ? t(item.button_text) : "",
      view_courses_button_text: item.view_courses_button_text ? t(item.view_courses_button_text) : "",
      view_courses_button_link: item.view_courses_button_link || "#courses",
      show_stats: item.show_stats === true || item.show_stats === "true",
      stat1_text: item.stat1_text ? t(item.stat1_text) : "",
      stat2_text: item.stat2_text ? t(item.stat2_text) : "",
      stat3_text: item.stat3_text ? t(item.stat3_text) : "",
      stat4_text: item.stat4_text ? t(item.stat4_text) : ""
    }));

  const activeSlides = slides.length > 0 ? slides : defaultSlides.map(s => ({
    ...s,
    tag: t(s.tag),
    heading: t(s.heading),
    highlight: t(s.highlight),
    desc: t(s.desc),
    buttonText: t(s.buttonText),
    viewCoursesButtonText: t(s.viewCoursesButtonText),
    viewCoursesButtonLink: s.viewCoursesButtonLink,
    showStats: s.showStats,
    stat1Text: t(s.stat1Text),
    stat2Text: t(s.stat2Text),
    stat3Text: t(s.stat3Text),
    stat4Text: t(s.stat4Text)
  }));

  useEffect(() => {
    if (activeSlides.length <= 1) return;
    const timer = setInterval(
      () => setCurrent((p) => (p + 1) % activeSlides.length),
      5000
    );
    return () => clearInterval(timer);
  }, [activeSlides]);

  // Handle image load
  const handleImageLoad = (key: string) => {
    setImagesLoaded(prev => ({ ...prev, [key]: true }));
  };

  useEffect(() => {
    // Calculate max height of all slides
    const heights = slideRefs.current
      .filter((ref): ref is HTMLDivElement => ref !== null)
      .map(ref => ref.offsetHeight);
    const contentHeight = Math.max(0, ...heights);
    const minHeight = 520;
    const maxHeight = Math.min(
      Math.max(contentHeight, minHeight),
      window.innerHeight * 0.8 // Cap at 80% of viewport height
    );
    setMaxSlideHeight(maxHeight);
  }, [activeSlides, t, imagesLoaded]);

  if (isLoading) {
    return (
      <div className="min-h-[520px] flex items-center justify-center bg-primary">
        <Loader2 className="w-10 h-10 animate-spin text-white" />
      </div>
    );
  }

  const slide = activeSlides[current];

  const allBadges = [
    { icon: GraduationCap, label: slide.stat1Text },
    { icon: Award, label: slide.stat2Text },
    { icon: Users, label: slide.stat3Text },
    { icon: CheckCircle, label: slide.stat4Text },
  ];

  const activeBadges = allBadges.filter(badge => badge.label);

  const defaultPartners = [
    t("Microsoft"),
    t("Google"),
    t("Adobe"),
    t("Tally Solutions"),
    t("NSDC"),
    t("NIELIT"),
    t("PMKVY"),
    t("Skill India"),
    t("ISO Certified")
  ];

  const partners = safeCmsArray
    .filter((item: any) => item.category === "heropartners" && item.active)
    .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
    .map((item: any) => ({
      id: item._id?.$oid || item._id || Math.random().toString(),
      name: t(item.title),
      image: item.image_url,
      link: item.link
    }));

  const activePartners = partners.length > 0 ? partners : defaultPartners.map(name => ({ name, image: null, link: null }));

  return (
    <section id="home" className="relative overflow-hidden">
      {/* Hidden measurement slides */}
      {activeSlides.map((s, i) => (
        <div
          key={`measure-${s.image}-${i}`}
          ref={(el) => (slideRefs.current[i] = el)}
          className="invisible absolute top-0 left-0 w-full pointer-events-none"
          aria-hidden="true"
        >
          <div className="container mx-auto px-4 py-8">
            <div className="max-w-3xl mx-auto text-center w-full">
              {s.tag && (
                <span className="inline-block bg-accent/20 text-accent px-5 py-1.5 rounded-full text-sm font-bold font-heading mb-4 whitespace-pre-line">
                  {s.tag}
                </span>
              )}
              {(s.heading || s.highlight) && (
                <h2 className="font-heading font-extrabold text-3xl md:text-5xl lg:text-6xl leading-tight mb-3 whitespace-pre-line">
                  {s.heading}
                  {s.highlight && (
                    <span className="block text-accent mt-2">
                      {s.highlight}
                    </span>
                  )}
                </h2>
              )}
              {s.desc && (
                <p className="text-lg md:text-xl mb-6 font-body max-w-2xl mx-auto leading-relaxed whitespace-pre-line">
                  {s.desc}
                </p>
              )}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
                {s.buttonText && (
                  <a className="w-full sm:w-auto bg-accent px-8 py-4 rounded-xl font-heading font-bold text-base">
                    {s.buttonText}
                  </a>
                )}
                {s.viewCoursesButtonText && (
                  <a className="w-full sm:w-auto border-2 px-8 py-4 rounded-xl font-heading font-semibold text-base">
                    {s.viewCoursesButtonText}
                  </a>
                )}
              </div>
              {activeSlides.length > 1 && (
                <div className="flex items-center justify-center gap-2 mb-6">
                  <button className="p-1">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  {activeSlides.map((_, j) => (
                    <button key={j} className="w-3 h-3 rounded-full" />
                  ))}
                  <button className="p-1">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
              {s.showStats && (
                <div className="flex justify-center">
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    {activeBadges.map((badge, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl"
                      >
                        <badge.icon className="w-5 h-5" />
                        <span className="text-sm font-semibold">
                          {badge.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Main Hero */}
      <div
        className="relative min-h-[520px]"
        style={{ height: maxSlideHeight ? `${maxSlideHeight}px` : '100vh' }}
      >
        {/* Background Image Carousel */}
        <div className="absolute inset-0">
          {activeSlides.map((s, i) => (
            <div key={s.image + i} className={`absolute inset-0 transition-opacity duration-1000 ease-out ${i === current ? "opacity-100" : "opacity-0"}`}>
              {/* Mobile Image (if provided, shown on small screens) */}
              {s.mobile_image && (
                <img
                  src={s.mobile_image}
                  alt="Slide Mobile"
                  className="absolute inset-0 w-full h-full object-fill sm:hidden"
                  onLoad={() => handleImageLoad(`main-mobile-${i}`)}
                />
              )}
              {/* Desktop Image (shown on md and above, fallback for mobile if no mobile image) */}
              <img
                src={s.image}
                alt="Slide"
                className={`absolute inset-0 w-full h-full object-fill ${s.mobile_image ? "hidden sm:block" : ""}`}
                onLoad={() => handleImageLoad(`main-desktop-${i}`)}
              />
            </div>
          ))}

          {/* Light overlay for better text readability */}
          <div className="absolute inset-0 bg-white/10" />
          <div className="absolute inset-0 bg-primary/70 mix-blend-multiply" />
        </div>

        {/* Hero Content */}
        <div className="container mx-auto px-4 py-8 relative z-10 h-full flex items-center">
          <div className="max-w-3xl mx-auto text-center w-full">
            {/* Slide content with key for re-render animation */}
            <div key={current} className="animate-fade-in-up">
              {slide.tag && (
                <span className="inline-block bg-accent/20 text-accent px-5 py-1.5 rounded-full text-sm font-bold font-heading mb-4 backdrop-blur-sm border border-accent/20 whitespace-pre-line">
                  {slide.tag}
                </span>
              )}
              {(slide.heading || slide.highlight) && (
                <h2 className="font-heading font-extrabold text-3xl md:text-5xl lg:text-6xl text-primary-foreground leading-tight mb-3 drop-shadow-md whitespace-pre-line">
                  {slide.heading}
                  {slide.highlight && (
                    <span className="block text-accent mt-2 drop-shadow-lg">
                      {slide.highlight}
                    </span>
                  )}
                </h2>
              )}
              {slide.desc && (
                <p className="text-primary-foreground/80 text-lg md:text-xl mb-6 font-body max-w-2xl mx-auto leading-relaxed whitespace-pre-line">
                  {slide.desc}
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
              {slide.buttonText && (
                <a
                  href={slide.link || "#contact"}
                  className="w-full sm:w-auto bg-accent text-accent-foreground px-8 py-4 rounded-xl font-heading font-bold text-base hover:bg-accent-dark transition-all shadow-lg hover:shadow-xl animate-pulse-glow"
                >
                  {slide.buttonText}
                </a>
              )}
              {slide.viewCoursesButtonText && (
                <a
                  href={slide.viewCoursesButtonLink}
                  className="w-full sm:w-auto border-2 border-primary-foreground/30 text-primary-foreground px-8 py-4 rounded-xl font-heading font-semibold text-base hover:bg-primary-foreground/10 transition-all backdrop-blur-sm"
                >
                  {slide.viewCoursesButtonText}
                </a>
              )}
            </div>

            {/* Carousel dots */}
            {activeSlides.length > 1 && (
              <div className="flex items-center justify-center gap-2 mb-6">
                <button
                  onClick={() =>
                    setCurrent((current - 1 + activeSlides.length) % activeSlides.length)
                  }
                  className="text-primary-foreground/50 hover:text-primary-foreground p-1"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                {activeSlides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrent(i)}
                    className={`w-3 h-3 rounded-full transition-all ${i === current ? "bg-accent w-8" : "bg-primary-foreground/30"}`}
                  />
                ))}

                <button
                  onClick={() => setCurrent((current + 1) % activeSlides.length)}
                  className="text-primary-foreground/50 hover:text-primary-foreground p-1"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Trust badges */}
            {slide.showStats && (
              <div className="flex justify-center">
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {activeBadges.map((badge, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-center gap-2 bg-primary-foreground/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-primary-foreground/10"
                    >
                      <badge.icon className="w-5 h-5 text-accent" />
                      <span className="text-primary-foreground text-sm font-semibold">
                        {badge.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Partners Marquee - merged into hero */}
      <div className="bg-primary-dark/90 backdrop-blur-sm py-4 overflow-hidden border-t border-primary-foreground/10">
        <div className="flex animate-marquee whitespace-nowrap">
          {[...activePartners, ...activePartners].map((partner: any, i) => (
            <div key={`${partner.id || partner.name}-${i}`}
              className="inline-flex items-center justify-center mx-4 px-6 py-2.5 bg-primary-foreground/10 rounded-lg border border-primary-foreground/10" >
              {partner.link ? (
                <a href={partner.link} target="_blank" rel="noreferrer" className="flex items-center justify-center w-full h-full">
                  {partner.image ? (
                    <img src={partner.image} alt={partner.name} className="h-10 w-auto object-contain" />
                  ) : (
                    <span className="font-heading font-bold text-primary-foreground/80 text-xs uppercase tracking-wider text-center whitespace-nowrap">{partner.name}</span>
                  )}
                </a>
              ) : (
                <div className="flex items-center justify-center w-full h-full">
                  {partner.image ? (
                    <img src={partner.image} alt={partner.name} className="h-10 w-auto object-contain" />
                  ) : (
                    <span className="font-heading font-bold text-primary-foreground/80 text-xs uppercase tracking-wider text-center whitespace-nowrap">{partner.name}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
export default HeroSection;