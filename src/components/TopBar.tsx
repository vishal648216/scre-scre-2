import { Phone, Mail, Loader2, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

interface CMSItem {
  _id: any;
  title: string;
  description?: string;
  link?: string;
  active: boolean;
}

const TopBar = () => {
  const { t } = useTranslation();
  const { data: verificationLink = "" } = useQuery({
    queryKey: ["cms-verification"],
    queryFn: async () => {
      const res = await apiFetch("/api/cms?category=verification&active_only=true");
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data[0].image_url || "";
      }
      return "";
    },
    staleTime: 1000 * 60 * 60, // 60 minutes
  });

  const { data: tickerItems, isLoading } = useQuery<CMSItem[]>({
    queryKey: ["cms-ticker"],
    queryFn: async () => {
      const res = await apiFetch("/api/cms?category=ticker&active_only=true");
      return res.json();
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  const getItemId = (item: CMSItem): string => {
    if (!item._id) return "";
    if (typeof item._id === "string") return item._id;
    if (typeof item._id === "object") {
      if (item._id.$oid) return item._id.$oid;
      return JSON.stringify(item._id);
    }
    return String(item._id);
  };

  return (
    <div className="bg-primary text-primary-foreground overflow-hidden">
      <div className="relative flex items-center h-8">

        {/* Left Static Label */}
        <div className="bg-accent text-accent-foreground px-3 h-full flex items-center text-[9px] sm:text-[10px] font-bold uppercase z-10 whitespace-nowrap shadow-[3px_0_10px_rgba(0,0,0,0.2)]">
          {t("Latest")}
        </div>

        {/* Moving Wrapper */}
        <div className="flex-1 overflow-x-auto scrollbar-hide cursor-grab active:cursor-grabbing select-none group touch-pan-x">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-3 h-3 animate-spin opacity-50" />
            </div>
          ) : (
            <div className="flex items-center animate-marquee whitespace-nowrap group-hover:[animation-play-state:paused] group-active:[animation-play-state:paused]">
              {/* Loop twice for smooth marquee */}
              {[1, 2].map((loop) => (
                <div key={loop} className="flex items-center gap-10 px-5 text-[9px] sm:text-[10px] font-medium uppercase tracking-wide">
                  {/* <div className="flex items-center gap-2 text-accent animate-pulse">
                    <span className="font-black">POWERED BY:</span>
                    <a href="https://codearya.com" target="_blank" rel="noopener noreferrer" className="hover:underline">CODEARYA PVT. LTD.</a>
                    <span className="text-white/20">•</span>
                  </div> */}
                  {tickerItems && tickerItems.length > 0 ? (
                    tickerItems.map((item, i) => {
                      const id = getItemId(item);
                      return (
                        <div key={`${loop}-${id || i}`} className="flex items-center gap-10">
                          <a
                            href={item.link || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-accent transition-colors duration-300 flex items-center gap-2"
                          >
                            <span className="font-black">{t(item.title)}</span>
                            <span>{t(item.description || "")}</span>
                          </a>
                          <span className="text-white/20">•</span>
                        </div>
                      );
                    })
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-10">
                        🎓 {t("Admissions Open 2026 – Apply Now for Certified Diploma & Skill Courses.")}
                        <span className="text-white/20">•</span>
                      </span>
                      <span className="inline-flex items-center gap-10">
                        📢 {t("Franchise Registration Open – Start Your Own Training Center Today.")}
                        <span className="text-white/20">•</span>
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopBar;