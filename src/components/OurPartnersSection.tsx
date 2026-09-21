import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslatedContent } from "@/hooks/useTranslatedContent";
import { useTranslation } from "react-i18next";

interface Partner {
  _id?: string;
  image_url: string;
  title?: string;
  link?: string;
}

const OurPartnersSection = () => {
  const { t } = useTranslation();
  const { data: content, isLoading: isContentLoadingAll } = useTranslatedContent();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const defaultPartners: Partner[] = [
    { image_url: "/images/icc-1.jpg", title: t("Partner 1") },
    { image_url: "/images/icc-2.jpg", title: t("Partner 2") },
    { image_url: "/images/icc-3.jpg", title: t("Partner 3") },
    { image_url: "/images/icc-1.jpg", title: t("Partner 4") },
    { image_url: "/images/icc-2.jpg", title: t("Partner 5") },
    { image_url: "/images/icc-3.jpg", title: t("Partner 6") },
  ];

  const partners = (() => {
    const cms = Array.isArray(content?.cms) ? content.cms : [];
    const safeCms = Array.isArray(cms) ? cms : [];
    const items = safeCms.filter((i: any) => {
      const cat = (i?.category || "").toString().toLowerCase();
      return cat === "partner" && i.image_url;
    });
    if (items.length === 0) return defaultPartners;
    return items.map((p: any) => ({
      _id: p._id?.$oid || p._id,
      image_url: p.image_url,
      title: t(p.title),
      link: p.link,
    })) as Partner[];
  })();

  const sectionContent = (() => {
    const cms = Array.isArray(content?.cms) ? content.cms : [];
    const page = cms.find((item: any) => {
      const cat = (item?.category || "").toString().toLowerCase();
      const title_str = (item?.title || "").toString().toLowerCase();
      const link_str = (item?.link || "").toString().toLowerCase();
      return cat === "page" && (title_str.includes("partner") || link_str.includes("partner"));
    });
    return page
      ? { title: t(page.title || "Our Partners"), description: t(page.description || "") }
      : { title: t("Our Partners"), description: "" };
  })();

  if (isContentLoadingAll) {
    return (
      <section className="py-24 bg-gradient-to-b from-background to-muted/30">
        <div className="container mx-auto px-4 flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
        </div>
      </section>
    );
  }

  if (!partners || partners.length === 0) return null;

  return (
    <section className="py-20 bg-gradient-to-b from-background to-muted/30 overflow-hidden">
      <div className="container mx-auto px-4 text-center mb-16">
        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">
          <span className="text-foreground">
            {sectionContent.title.split(" ").slice(0, -1).join(" ") || t("Our")}{" "}
          </span>
          <span className="text-secondary relative">
            {sectionContent.title.split(" ").pop() || t("Partners")}
            <span className="absolute left-0 -bottom-2 h-1 w-full bg-secondary/40 rounded-full"></span>
          </span>
        </h2>
        {sectionContent.description && (
          <p className="text-muted-foreground mt-4 max-w-2xl mx-auto text-lg">
            {sectionContent.description}
          </p>
        )}
      </div>

      <div className="relative w-full overflow-hidden">
        <div className="pointer-events-none absolute left-0 top-0 z-20 h-full w-32 bg-gradient-to-r from-background via-background/50 to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-32 bg-gradient-to-l from-background via-background/50 to-transparent" />

        <div className="flex animate-marquee gap-8 items-center py-10">
          {[...partners, ...partners].map((partner, i) => {
            const uniqueId = `partner-${partner._id || i}-${i}`;
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
                  href={partner.link || "#"}
                  target={partner.link ? "_blank" : undefined}
                  rel={partner.link ? "noopener noreferrer" : undefined}
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
                    hover:shadow-secondary/10
                    hover:border-secondary/20
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
                        src={partner.image_url}
                        alt={partner.title || "Partner"}
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
                px-3
                transition-all
                duration-700
                ease-out
                ${isHovered
                          ? "opacity-100 translate-y-0 max-h-32"
                          : "opacity-0 translate-y-4 max-h-0 overflow-hidden"
                        }
              `}
                    >
                      {partner.title && (
                        <p className="text-sm font-bold text-foreground leading-tight break-words whitespace-normal">
                          {partner.title}
                        </p>
                      )}
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

export default OurPartnersSection;
