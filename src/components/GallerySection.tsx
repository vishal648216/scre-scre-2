import { useState, useEffect, useRef } from "react";
import { ArrowUpRight, X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useTranslatedContent } from "@/hooks/useTranslatedContent";
import { useTranslation } from "react-i18next";

const GallerySection = () => {
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const defaultGalleryItems = [
    {
      title: t("Computer Lab"),
      desc: t("Modern air-conditioned labs with latest high-performance systems."),
      image: "/images/icc-1.jpg",
    },
    {
      title: t("Interactive Classroom"),
      desc: t("Smart boards & interactive live sessions."),
      image: "/images/icc-2.jpg",
    },
    {
      title: t("Seminar Hall"),
      desc: t("Guest lectures & industry workshops."),
      image: "/images/icc-3.jpg",
    },
    {
      title: t("Placement Drive"),
      desc: t("Campus recruitment & mock interviews."),
      image: "/images/icc-2.jpg",
    },
    {
      title: t("Award Ceremony"),
      desc: t("Celebrating student excellence."),
      image: "/images/icc-3.jpg",
    },
  ];

  const { data: content, isLoading } = useTranslatedContent();
  const galleryItems = (() => {
    const cms = Array.isArray(content?.cms) ? content.cms : [];
    const safeCms = Array.isArray(cms) ? cms : [];
    const gallery = safeCms.filter((i: any) => {
      const cat = (i?.category || "").toString().toLowerCase();
      return cat === "gallery";
    });
    if (gallery.length === 0) return defaultGalleryItems;

    const mainItem = gallery.find((i: any) => i.is_main);
    const featuredItems = gallery.filter((i: any) => i.is_featured).slice(0, 4);

    let selectedItems: any[] = [];
    if (mainItem) selectedItems.push(mainItem);
    if (selectedItems.length === 0 && gallery.length > 0) {
      selectedItems.push(gallery[0]);
    }
    const mainId = selectedItems[0]?._id;
    featuredItems.forEach((item: any) => {
      if (item._id !== mainId) selectedItems.push(item);
    });
    if (selectedItems.length < 5) {
      const others = gallery.filter((i: any) => !i.is_main && !i.is_featured && i._id !== mainId);
      selectedItems = [...selectedItems, ...others.slice(0, 5 - selectedItems.length)];
    }

    return selectedItems.map((item: any) => ({
      title: t(item.title || ""),
      desc: t(item.description || ""),
      image: item.image_url,
    }));
  })();

  const activeItem =
    activeIndex !== null ? galleryItems[activeIndex] : null;

  const nextSlide = () => {
    setActiveIndex((prev) =>
      prev === galleryItems.length - 1 ? 0 : prev + 1
    );
  };

  const prevSlide = () => {
    setActiveIndex((prev) =>
      prev === 0 ? galleryItems.length - 1 : prev - 1
    );
  };

  // ESC + Scroll Lock
  useEffect(() => {
    if (activeIndex !== null) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    const handleEsc = (e) => {
      if (e.key === "Escape") setActiveIndex(null);
    };

    window.addEventListener("keydown", handleEsc);

    return () => {
      document.body.style.overflow = "auto";
      window.removeEventListener("keydown", handleEsc);
    };
  }, [activeIndex]);

  // Swipe Support
  const handleTouchStart = (e) => {
    touchStartX.current = e.changedTouches[0].screenX;
  };

  const handleTouchEnd = (e) => {
    touchEndX.current = e.changedTouches[0].screenX;
    if (touchStartX.current - touchEndX.current > 50) nextSlide();
    if (touchEndX.current - touchStartX.current > 50) prevSlide();
  };

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (galleryItems.length === 0) return null;

  return (
    <section className="py-28 bg-background relative overflow-hidden">
      <div className="container mx-auto">
        <div className="text-center mb-20">
          <span className="inline-block bg-accent/10 text-accent font-bold text-xs uppercase tracking-widest px-4 py-1.5 rounded-full border border-accent/20">
            {t("Gallery")}
          </span>

          <h2 className="text-4xl md:text-5xl font-extrabold text-foreground mt-5">
            {t("Experience Our Campus Life")}
          </h2>

          <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
            {t("Explore our modern infrastructure, learning environment and student success moments.")}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 items-stretch">
          <div
            onClick={() => setActiveIndex(0)}
            className="relative rounded-3xl overflow-hidden group cursor-pointer h-[500px] hover-popup-subtle transition-all duration-700"
          >
            <img
              src={galleryItems[0].image}
              alt=""
              className="w-full h-full object-fill transition duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/40 to-transparent"></div>
            <div className="absolute bottom-8 left-8 text-white">
              <h3 className="text-2xl font-bold">
                {galleryItems[0].title}
              </h3>
              <p className="text-white/80 mt-2 text-sm max-w-sm">
                {galleryItems[0].desc}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {galleryItems.slice(1).map((item, index) => (
              <div
                key={index}
                onClick={() => setActiveIndex(index + 1)}
                className="relative rounded-3xl overflow-hidden cursor-pointer group h-[240px] hover-popup-subtle transition-all duration-700"
              >
                <img
                  src={item.image}
                  alt=""
                  className="w-full h-full object-fill transition duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/30 to-transparent opacity-90 group-hover:opacity-100 transition"></div>
                <div className="absolute bottom-5 left-5 text-white">
                  <h4 className="font-bold text-lg flex items-center gap-2">
                    {item.title}
                    <ArrowUpRight size={18} />
                  </h4>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 🔥 PRO LIGHTBOX */}
      {activeItem && (
        <div
          onClick={() => setActiveIndex(null)}
          className="fixed inset-0 bg-primary/95 backdrop-blur-md flex items-center justify-center z-50 p-6 transition-opacity duration-300"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="relative max-w-6xl w-full animate-fadeIn"
          >
            {/* Close */}
            <button
              onClick={() => setActiveIndex(null)}
              className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition z-20"
            >
              <X size={24} />
            </button>

            {/* Prev */}
            <button
              onClick={prevSlide}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition z-20"
            >
              <ChevronLeft size={28} />
            </button>

            {/* Next */}
            <button
              onClick={nextSlide}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition z-20"
            >
              <ChevronRight size={28} />
            </button>

            {/* Image with Zoom */}
            <div className="overflow-hidden rounded-3xl">
              <img
                src={activeItem.image}
                alt=""
                className="w-full max-h-[80vh] object-contain transition-transform duration-500 hover:scale-110"
              />
            </div>

            {/* Caption */}
            <div className="text-center mt-6">
              <h3 className="text-white text-2xl font-bold">
                {activeItem.title}
              </h3>
              <p className="text-white/70 mt-3 max-w-2xl mx-auto">
                {activeItem.desc}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default GallerySection;
