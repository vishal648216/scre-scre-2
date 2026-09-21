import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useHomeData } from "@/hooks/useHomeData";
import { Loader2 } from "lucide-react";

const UniversitiesSection = () => {
  const { t } = useTranslation();
  const { data: homeData, isLoading } = useHomeData();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const defaultUniversities = [
    { id: "default-1", image: "/images/icc-1.jpg", name: "University 1", link: "#" },
    { id: "default-2", image: "/images/icc-2.jpg", name: "University 2", link: "#" },
    { id: "default-3", image: "/images/icc-3.jpg", name: "University 3", link: "#" },
    { id: "default-4", image: "/images/icc-1.jpg", name: "University 4", link: "#" },
    { id: "default-5", image: "/images/icc-2.jpg", name: "University 5", link: "#" },
    { id: "default-6", image: "/images/icc-3.jpg", name: "University 6", link: "#" },
  ];

  const cmsArray = Array.isArray(homeData?.cms) ? homeData.cms : [];
  const safeCmsArray = Array.isArray(cmsArray) ? cmsArray : [];

  const universities = safeCmsArray
    .filter((item: any) => item.category === "university" && item.active)
    .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
    .map((item: any) => ({
      id: item._id?.$oid || item._id || Math.random().toString(),
      name: t(item.title),
      image: item.image_url,
      link: item.link || "#",
    }));

  const activeUniversities = universities.length > 0 ? universities : defaultUniversities;

  if (isLoading) {
    return (
      <section className="py-24 bg-gradient-to-b from-muted/30 to-background">
        <div className="container mx-auto px-4 flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 bg-gradient-to-b from-muted/30 to-background overflow-hidden">
      <div className="container mx-auto px-4 text-center mb-16">
        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">
          <span className="text-foreground">{t("Universities Joined with")}{" "}</span>
          <span className="text-primary">{t("SCRE")}</span>
        </h2>
        <p className="text-muted-foreground mt-4 max-w-2xl mx-auto text-lg">
          {t("Partnering with recognized universities and institutions to deliver certified and industry-relevant education programs.")}
        </p>
      </div>

      <div className="relative w-full overflow-hidden">
        <div className="pointer-events-none absolute left-0 top-0 z-20 h-full w-32 bg-gradient-to-r from-muted/30 via-muted/10 to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-32 bg-gradient-to-l from-muted/30 via-muted/10 to-transparent" />

        <div className="flex animate-marquee gap-8 items-center py-10">
          {[...activeUniversities, ...activeUniversities].map((uni, i) => {
            const uniqueId = `${uni.id}-${i}`;
            const isHovered = hoveredId === uniqueId;

            return (
              <div
                key={uniqueId}
                className="relative flex-shrink-0"
                style={{
                  width: "180px",
                  height: "120px",
                }}
              >
                <a
                  href={uni.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onMouseEnter={() => setHoveredId(uniqueId)}
                  onMouseLeave={() => setHoveredId(null)}
                  className="
                    absolute
                    inset-0
                    flex
                    flex-col
                    items-center
                    justify-center
                    bg-white/80
                    backdrop-blur-sm
                    rounded-3xl
                    border-2
                    border-transparent
                    shadow-sm
                    hover:shadow-2xl
                    hover:shadow-primary/10
                    hover:border-primary/20
                    cursor-pointer
                    transition-all
                    duration-700
                    ease-out
                    overflow-hidden
                  "
                  style={{
                    transform: isHovered ? "scale(1.35)" : "scale(1)",
                    zIndex: isHovered ? 10 : 1,
                  }}
                >
                  <div className="w-full h-full flex flex-col items-center justify-center p-4">
                    <div className="relative w-full flex-1 flex items-center justify-center">
                      <img
                        src={uni.image}
                        alt={uni.name}
                        className="object-contain transition-all duration-700 ease-out"
                        style={{
                          maxHeight: isHovered ? "80px" : "60px",
                          maxWidth: "90%",
                          filter: isHovered ? "none" : "grayscale(100%) brightness(0.85)",
                          opacity: isHovered ? 1 : 0.8,
                        }}
                      />
                    </div>

                    <div
                      className={`
                        w-full
                        text-center
                        px-2
                        transition-all
                        duration-700
                        ease-out
                        ${isHovered
                          ? "opacity-100 translate-y-0 max-h-24"
                          : "opacity-0 translate-y-4 max-h-0 overflow-hidden"
                        }
                      `}
                    >
                      <p className="text-sm font-bold text-foreground leading-tight break-words whitespace-normal">
                        {uni.name}
                      </p>
                    </div>
                  </div>
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default UniversitiesSection;