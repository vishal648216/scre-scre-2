import { useState, useEffect, useRef } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  Play,
  Camera,
  Maximize2,
  ArrowUpRight,
  Layers,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { cn, normalizeAssetUrl } from "@/lib/utils";

const MasonryItem = ({
  children,
  className,
  index,
}: {
  children: React.ReactNode;
  className?: string;
  index: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 30, rotate: index % 2 === 0 ? 2 : -2 }}
    whileInView={{ opacity: 1, y: 0, rotate: 0 }}
    viewport={{ once: true, margin: "-100px" }}
    transition={{ duration: 0.6, ease: "easeOut", delay: index * 0.05 }}
    className={cn("break-inside-avoid mb-6 group", className)}
  >
    {children}
  </motion.div>
);

const GalleryCard = ({
  img,
  index,
  onClick,
}: {
  img: any;
  index: number;
  onClick: () => void;
}) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseXSpring = useSpring(x, { stiffness: 400, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 400, damping: 30 });
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["20deg", "-20deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-20deg", "20deg"]);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width - 0.5;
    const yPct = (e.clientY - rect.top) / rect.height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
    setIsHovered(false);
  };

  const aspectClasses = [
    "aspect-[3/4]",
    "aspect-square",
    "aspect-[4/3]",
    "aspect-[5/4]",
    "aspect-[9/16]",
  ];
  const randomAspect = aspectClasses[index % aspectClasses.length];

  return (
    <motion.div
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
        perspective: "1500px",
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className="relative group cursor-pointer"
    >
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-3xl bg-card/40 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.4)] transition-all duration-500",
          randomAspect
        )}
      >
        {img.type === "video" ? (
          <motion.video
            initial={{ scale: 1.1 }}
            whileHover={{ scale: 1.3 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            src={img.videoUrl || img.src}
            muted
            playsInline
            loop
            className="absolute inset-0 w-full h-full object-fill"
          />
        ) : (
          <motion.img
            initial={{ scale: 1.1 }}
            whileHover={{ scale: 1.3 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            src={normalizeAssetUrl(img.src) || "/images/icc-1.jpg"}
            alt={img.title || "Gallery Image"}
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement;
              if (!target.dataset.fallbackApplied) {
                target.dataset.fallbackApplied = "true";
                target.src = "/images/icc-1.jpg";
              }
            }}
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent opacity-60 group-hover:opacity-90 transition-all duration-700" />

        <div className="absolute inset-0 flex flex-col justify-between p-6 z-10">
          <div className="flex justify-end">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : -20 }}
              transition={{ duration: 0.4 }}
              className="flex gap-2"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(img.src, "_blank");
                }}
                className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white/80 hover:bg-primary hover:text-white hover:border-primary transition-all duration-300 flex items-center justify-center shadow-lg"
              >
                <ArrowUpRight className="w-5 h-5" />
              </button>
            </motion.div>
          </div>

          <div className="space-y-3">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 30 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="h-[2px] w-8 bg-primary/70" />
                <span className="text-[10px] font-black uppercase tracking-[0.45em] text-primary/90">
                  {img.category || "MOMENT"}
                </span>
              </div>

              <h3 className="text-2xl md:text-3xl font-black text-white leading-tight tracking-tight mb-1">
                {img.title || "Captured Moment"}
              </h3>

              <p className="text-sm text-white/70 font-medium line-clamp-2 leading-relaxed">
                {img.description}
              </p>

              {img.type === "video" && (
                <div className="mt-4 inline-flex items-center gap-2 bg-red-600/90 backdrop-blur-sm px-4 py-1.5 rounded-full">
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">
                    Video Clip
                  </span>
                </div>
              )}
            </motion.div>
          </div>
        </div>

        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{
            background: isHovered
              ? "linear-gradient(135deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0) 100%)"
              : "transparent",
            backgroundPosition: isHovered
              ? ["0% 0%", "100% 100%"]
              : "0% 0%",
          }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
        />
      </div>
    </motion.div>
  );
};

const GalleryPage = () => {
  const { t, i18n } = useTranslation();
  const [gallery, setGallery] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [visibleItemCount, setVisibleItemCount] = useState(10);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const lang = i18n.language.split("-")[0].toLowerCase();
        const [galleryRes, categoriesRes] = await Promise.all([
          apiFetch(`/api/cms?category=gallery&active_only=true&lang=${lang}`),
          apiFetch(
            `/api/cms?category=gallerycategory&active_only=true&lang=${lang}`
          ),
        ]);

        const galleryData = await galleryRes.json();
        const categoriesData = await categoriesRes.json();

        if (Array.isArray(galleryData)) {
          const mapped = galleryData.map((item) => {
            const videoUrl = item.video_url || item.content;
            const isVideo = item.designation === "video" || (videoUrl && (videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be") || videoUrl.startsWith("/uploads/")));
            return {
              src: normalizeAssetUrl(item.image_url) || "/images/icc-1.jpg",
              category: (item.link || item.category || "general").toLowerCase(),
              title: item.title,
              type: isVideo ? "video" : "image",
              description: item.description || "Experience the vibrant campus life and state-of-the-art facilities at Sir Chhotu Ram Education.",
              videoUrl: videoUrl,
              isFeatured: item.is_featured,
              isMain: item.is_main,
            };
          });
          setGallery(mapped.reverse());
        }

        if (Array.isArray(categoriesData)) {
          const mappedCats = [
            { label: t("All"), value: "all" },
            ...categoriesData.map((cat) => ({
              label: t(cat.title),
              value: cat.title.toLowerCase(),
            })),
          ];
          setCategories(mappedCats);
        } else {
          setCategories([{ label: t("All"), value: "all" }]);
        }
      } catch (err) {
        console.error("Failed to fetch gallery data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [t, i18n.language]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedIdx === null) return;
      if (e.key === "Escape") setSelectedIdx(null);
      if (e.key === "ArrowRight")
        setSelectedIdx((selectedIdx + 1) % filtered.length);
      if (e.key === "ArrowLeft")
        setSelectedIdx((selectedIdx - 1 + filtered.length) % filtered.length);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIdx, gallery.length]);

  const filtered =
    activeCategory === "all"
      ? gallery
      : gallery.filter((img) => img.category === activeCategory);

  const visibleItems = filtered.slice(0, visibleItemCount);
  const hasMoreItems = visibleItemCount < filtered.length;

  const loadMore = () => {
    setVisibleItemCount((prev) => prev + 10);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-8">
            <div className="relative">
              <Loader2 className="w-24 h-24 animate-spin text-primary/20" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Camera className="w-10 h-10 text-primary animate-pulse" />
              </div>
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.6em] text-muted-foreground animate-pulse">
              Curating Moments...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background selection:bg-primary/10 relative overflow-x-hidden">
      <Header />
      <main className="pt-20 pb-24">
        {/* Hero Section */}
        <section className="container mx-auto px-4 mb-16 text-center relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-3 px-6 py-2.5 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-xl">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-foreground/70">
                {t("Immersive Photo Walk")}
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl font-black text-foreground uppercase tracking-tighter mb-6 leading-[0.9]">
              {t("Our Story in")}{" "}
              <span className="bg-gradient-to-r from-primary via-primary/70 to-primary bg-clip-text text-transparent relative inline-block">
                {t("Frames")}
              </span>
            </h1>

            <p className="text-muted-foreground max-w-2xl mx-auto text-base md:text-lg font-medium leading-relaxed">
              {t(
                "Every click captures a chapter of our journey. Wander through classrooms, celebrations, and milestones that shape SCRE."
              )}
            </p>
          </motion.div>
        </section>

        {/* Category Filters */}
        <section className="container mx-auto px-4 mb-12">
          <div className="flex flex-wrap justify-center gap-3 items-center">
            {(showAllCategories
              ? categories
              : categories.slice(0, 5)
            ).map((cat) => (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className={cn(
                  "relative px-6 py-3 rounded-3xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 overflow-hidden",
                  activeCategory === cat.value
                    ? "text-white bg-primary shadow-[0_0_40px_rgba(var(--primary),0.2)]"
                    : "text-muted-foreground bg-white/5 border border-white/10 hover:bg-white/10 hover:text-foreground"
                )}
              >
                {cat.label}
                {activeCategory === cat.value && (
                  <motion.div
                    layoutId="active-category"
                    className="absolute inset-0 -z-10"
                    transition={{
                      type: "spring",
                      bounce: 0.2,
                      duration: 0.8,
                    }}
                  />
                )}
              </button>
            ))}
            {categories.length > 5 && (
              <button
                onClick={() => setShowAllCategories(!showAllCategories)}
                className="px-6 py-3 rounded-3xl text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-white/5 border border-white/10 hover:bg-white/10 hover:text-foreground transition-all duration-300"
              >
                {showAllCategories ? t("Show Less") : t("Show More")}
              </button>
            )}
          </div>
        </section>

        {/* Masonry Gallery */}
        <section className="container mx-auto px-4 mb-12">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6"
            >
              {visibleItems.length > 0 ? (
                visibleItems.map((img, idx) => (
                  <MasonryItem key={img.src + idx} index={idx}>
                    <GalleryCard
                      img={img}
                      index={idx}
                      onClick={() => setSelectedIdx(idx)}
                    />
                  </MasonryItem>
                ))
              ) : (
                <div className="col-span-full py-20 text-center">
                  <div className="inline-flex flex-col items-center gap-6 bg-white/5 border border-white/10 rounded-3xl px-12 py-12 backdrop-blur-xl">
                    <Camera className="w-16 h-16 text-primary/30" />
                    <p className="text-[11px] font-black uppercase tracking-[0.5em] text-muted-foreground">
                      No memories in this album yet
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </section>

        {/* Load More Button */}
        {hasMoreItems && (
          <section className="container mx-auto px-4 text-center">
            <button
              onClick={loadMore}
              className="px-8 py-4 rounded-3xl bg-primary text-primary-foreground font-black uppercase tracking-widest text-sm hover:bg-primary/90 transition-all shadow-lg"
            >
              {t("Load More")}
            </button>
          </section>
        )}
      </main>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {selectedIdx !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-4 md:p-8"
          >
            {/* Close Button */}
            <motion.button
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 45 }}
              whileHover={{ scale: 1.1, rotate: 90 }}
              onClick={() => setSelectedIdx(null)}
              className="absolute top-6 right-6 z-[110] p-4 bg-white/10 hover:bg-white/20 rounded-2xl text-white/80 hover:text-white transition-all duration-300 border border-white/10 backdrop-blur-xl"
            >
              <X className="w-6 h-6" />
            </motion.button>

            {/* Left/Right Navigation */}
            {filtered.length > 1 && (
              <>
                <motion.button
                  whileHover={{ scale: 1.1, x: -8 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedIdx(
                      (selectedIdx - 1 + filtered.length) % filtered.length
                    );
                  }}
                  className="absolute left-6 z-[110] p-5 text-white/40 hover:text-primary hover:bg-white/10 transition-all duration-300 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-xl"
                >
                  <ChevronLeft className="w-9 h-9" />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.1, x: 8 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedIdx((selectedIdx + 1) % filtered.length);
                  }}
                  className="absolute right-6 z-[110] p-5 text-white/40 hover:text-primary hover:bg-white/10 transition-all duration-300 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-xl"
                >
                  <ChevronRight className="w-9 h-9" />
                </motion.button>
              </>
            )}

            {/* Lightbox Content */}
            <motion.div
              key={selectedIdx}
              initial={{ opacity: 0, scale: 0.85, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{
                type: "spring",
                damping: 25,
                stiffness: 220,
              }}
              className="relative w-full max-w-6xl"
            >
              <div className="flex flex-col lg:flex-row gap-8 items-center">
                {/* Media Container */}
                <div className="flex-1 w-full">
                  {filtered[selectedIdx].type === "video" ? (
                    <div className="w-full aspect-video rounded-3xl overflow-hidden shadow-[0_50px_120px_rgba(0,0,0,0.9)] border border-white/10 bg-black">
                      {(() => {
                        const url = filtered[selectedIdx].videoUrl;
                        if (!url) return null;

                        if (url.includes("youtube.com") || url.includes("youtu.be")) {
                          const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
                          const match = url.match(regExp);
                          const embedUrl = match && match[2].length === 11
                            ? `https://www.youtube.com/embed/${match[2]}?autoplay=1&modestbranding=1&rel=0`
                            : null;

                          return embedUrl ? (
                            <iframe
                              src={embedUrl}
                              className="w-full h-full"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/40 font-black uppercase tracking-[0.4em]">
                              Video Stream Unavailable
                            </div>
                          );
                        } else if (url.startsWith("/uploads/")) {
                          return (
                            <video
                              src={url}
                              controls
                              autoPlay
                              className="w-full h-full object-contain"
                            />
                          );
                        }
                        return null;
                      })()}
                    </div>
                  ) : (
                    <div className="relative group">
                      <img
                        src={normalizeAssetUrl(filtered[selectedIdx].src) || "/images/icc-1.jpg"}
                        alt={filtered[selectedIdx].title}
                        className="w-full max-h-[75vh] object-contain rounded-3xl shadow-[0_50px_120px_rgba(0,0,0,0.85)] border border-white/10"
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (!target.dataset.fallbackApplied) {
                            target.dataset.fallbackApplied = "true";
                            target.src = "/images/icc-1.jpg";
                          }
                        }}
                      />
                      <div className="absolute bottom-6 right-6 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <button
                          onClick={() =>
                            window.open(filtered[selectedIdx].src, "_blank")
                          }
                          className="p-4 bg-white/15 hover:bg-white/25 text-white rounded-2xl backdrop-blur-xl border border-white/20 transition-all duration-300"
                        >
                          <Maximize2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sidebar Info */}
                <div className="w-full lg:w-80 text-white space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="h-[1px] flex-1 bg-white/10" />
                      <span className="text-primary text-[10px] font-black uppercase tracking-[0.5em] whitespace-nowrap">
                        {filtered[selectedIdx].category || "GALLERY"}
                      </span>
                      <div className="h-[1px] flex-1 bg-white/10" />
                    </div>

                    <h2 className="text-3xl md:text-4xl font-black leading-tight tracking-tight">
                      {filtered[selectedIdx].title}
                    </h2>
                  </div>

                  <p className="text-white/60 text-sm md:text-base leading-relaxed">
                    {filtered[selectedIdx].description}
                  </p>

                  <div className="pt-6 border-t border-white/10">
                    <p className="text-white/30 text-xs font-medium uppercase tracking-[0.3em]">
                      {selectedIdx + 1} / {filtered.length}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <Footer />
    </div>
  );
};

export default GalleryPage;
