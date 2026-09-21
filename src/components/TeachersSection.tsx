import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useHomeData } from "@/hooks/useHomeData";
import { useTranslation } from "react-i18next";
import { normalizeAssetUrl } from "@/lib/utils";

const TeachersSection = () => {
  const { data: homeData, isLoading } = useHomeData();
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolling = useRef(false);
  const userScrollTimeout = useRef<NodeJS.Timeout | null>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const startScrollLeft = useRef(0);
  const animationId = useRef<number | null>(null);

  const defaultTeachers = [
    {
      id: "default-1",
      name: t("Rajesh Verma"),
      role: t("Senior Web Development Trainer"),
      image: "/images/icc-1.jpg",
      experience: t("8+ Years Experience"),
      education: t("M.Tech in Computer Science"),
      about: t("Specializes in full-stack web development with expertise in modern frameworks and real-world project implementation."),
    },
    {
      id: "default-2",
      name: t("Neha Sharma"),
      role: t("Accounting & GST Expert"),
      image: "/images/icc-2.jpg",
      experience: t("6+ Years Experience"),
      education: t("MBA in Finance"),
      about: t("Experienced in GST compliance, financial accounting, and practical training for commerce students."),
    },
    {
      id: "default-3",
      name: t("Amit Kapoor"),
      role: t("Graphic Design Specialist"),
      image: "/images/icc-3.jpg",
      experience: t("7+ Years Experience"),
      education: t("B.Des in Visual Communication"),
      about: t("Creative designer with expertise in UI/UX, branding, and industry-standard design tools."),
    },
    {
      id: "default-4",
      name: t("Pooja Malik"),
      role: t("Spoken English Trainer"),
      image: "/images/icc-2.jpg",
      experience: t("5+ Years Experience"),
      education: t("MA in English Literature"),
      about: t("Dedicated to improving communication skills and confidence in spoken English for all levels."),
    },
  ];

  const cmsArray = Array.isArray(homeData?.cms) ? homeData.cms : [];
  const safeCmsArray = Array.isArray(cmsArray) ? cmsArray : [];

  const teachers = safeCmsArray
    .filter((item: any) => item.category === "teacher" && item.active)
    .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
    .map((item: any, idx: number) => {
      const fallback = defaultTeachers[idx % defaultTeachers.length];
      return {
        id: item._id?.$oid || item._id || Math.random().toString(),
        name: t(item.title) || fallback.name,
        role: t(item.designation || "") || fallback.role,
        image: normalizeAssetUrl(item.image_url) || fallback.image,
        experience: t(item.specialization || "Expert Trainer") || fallback.experience,
        education: item.education || fallback.education,
        about: item.description || item.content || item.bio || item.short_bio || fallback.about,
        fallbackImage: fallback.image,
      };
    });

  const activeTeachers = teachers.length > 0 ? teachers : defaultTeachers;
  const displayTeachers = activeTeachers;

  // Auto scroll with manual scroll support
  useEffect(() => {
    if (isLoading || !scrollRef.current) return;

    let scrollPos = scrollRef.current.scrollLeft;

    const handleUserScroll = () => {
      userScrolling.current = true;
      scrollPos = scrollRef.current!.scrollLeft;

      if (userScrollTimeout.current) {
        clearTimeout(userScrollTimeout.current);
      }

      userScrollTimeout.current = setTimeout(() => {
        userScrolling.current = false;
      }, 1500); // Resume after 1.5 seconds of no scrolling
    };

    const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
      isDragging.current = true;
      if ('touches' in e) {
        startX.current = e.touches[0].clientX;
        startY.current = e.touches[0].clientY;
      } else {
        startX.current = (e as React.MouseEvent).pageX - (scrollRef.current?.offsetLeft || 0);
      }
      startScrollLeft.current = scrollRef.current?.scrollLeft || 0;
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
        currentX = (e as React.MouseEvent).pageX - (scrollRef.current.offsetLeft || 0);
        const walk = (currentX - startX.current) * 1.5;
        scrollRef.current.scrollLeft = startScrollLeft.current - walk;
      }
    };

    const handleMouseUpOrLeave = () => {
      isDragging.current = false;
    };

    scrollRef.current.addEventListener("scroll", handleUserScroll, { passive: true });
    scrollRef.current.addEventListener("mousedown", handleMouseDown as any);
    scrollRef.current.addEventListener("mousemove", handleMouseMove as any);
    scrollRef.current.addEventListener("mouseup", handleMouseUpOrLeave);
    scrollRef.current.addEventListener("mouseleave", handleMouseUpOrLeave);
    scrollRef.current.addEventListener("touchstart", handleMouseDown as any);
    scrollRef.current.addEventListener("touchmove", handleMouseMove as any);
    scrollRef.current.addEventListener("touchend", handleMouseUpOrLeave);

    const scroll = () => {
      if (!scrollRef.current) return;

      const maxScroll = scrollRef.current.scrollWidth - scrollRef.current.clientWidth;

      if (!userScrolling.current && !isDragging.current) {
        scrollPos += 0.7;

        if (scrollPos >= maxScroll) {
          scrollPos = 0;
        }

        scrollRef.current.scrollLeft = scrollPos;
      }

      animationId.current = requestAnimationFrame(scroll);
    };

    animationId.current = requestAnimationFrame(scroll);

    return () => {
      if (animationId.current) {
        cancelAnimationFrame(animationId.current);
      }
      if (scrollRef.current) {
        scrollRef.current.removeEventListener("scroll", handleUserScroll);
        scrollRef.current.removeEventListener("mousedown", handleMouseDown as any);
        scrollRef.current.removeEventListener("mousemove", handleMouseMove as any);
        scrollRef.current.removeEventListener("mouseup", handleMouseUpOrLeave);
        scrollRef.current.removeEventListener("mouseleave", handleMouseUpOrLeave);
        scrollRef.current.removeEventListener("touchstart", handleMouseDown as any);
        scrollRef.current.removeEventListener("touchmove", handleMouseMove as any);
        scrollRef.current.removeEventListener("touchend", handleMouseUpOrLeave);
      }
      if (userScrollTimeout.current) {
        clearTimeout(userScrollTimeout.current);
      }
    };
  }, [isLoading]);

  if (isLoading) {
    return (
      <div className="py-20 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!activeTeachers || activeTeachers.length === 0) return null;

  return (
    <section id="teachers" className="py-24 bg-[#f8f5f0]">
      <div className="container mx-auto px-4">
        {/* Heading */}
        <div className="text-center mb-16">
          <span className="inline-block bg-[#e5e0d8] text-[#0f3460] text-xs uppercase tracking-widest font-bold px-5 py-2 rounded-full">
            {t("OUR FACULTY")}
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-[#0f3460] mt-6">
            {t("Meet Our Expert Trainers")}
          </h2>
          <p className="text-[#6b7280] mt-4 max-w-2xl mx-auto text-lg">
            {t("Our experienced faculty members bring real industry knowledge and practical expertise to ensure students receive career-focused training.")}
          </p>
        </div>

        {/* Teachers Horizontal Scroll */}
        <div
          ref={scrollRef}
          className="flex gap-6 overflow-x-auto pb-8 snap-x snap-mandatory custom-scrollbar select-none"
          style={{ scrollBehavior: 'auto', cursor: isDragging.current ? 'grabbing' : 'grab' }}
        >
          {displayTeachers.map((teacher: any, index: number) => (
            <article
              key={teacher.id || teacher.name || index}
              className="
      group
      relative
      w-[330px]
      h-[420px]
      flex
      flex-col
      flex-shrink-0
      snap-start
      overflow-hidden
      rounded-[24px]
      bg-white
      shadow-[0_10px_30px_rgba(0,0,0,0.08)]
      hover:shadow-[0_20px_50px_rgba(15,52,96,0.15)]
      transition-all
      duration-500
      hover:-translate-y-2
    "
            >
              {/* Image */}
              <div className="relative h-[190px] min-h-[190px] max-h-[190px] overflow-hidden">
                <img
                  src={teacher.image || teacher.fallbackImage || "/images/icc-1.jpg"}
                  alt={teacher.name}
                  className="
          w-full
          h-full
          object-cover
          transition-all
          duration-700
          group-hover:scale-105
        "
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.dataset.fallbackApplied) {
                      target.dataset.fallbackApplied = "true";
                      target.src = teacher.fallbackImage || "/images/icc-1.jpg";
                    }
                  }}
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

                <div
                  className="
          absolute
          top-4
          left-4
          bg-[#0f3460]
          text-white
          px-4
          py-1.5
          rounded-full
          text-[10px]
          font-bold
          uppercase
          tracking-[0.2em]
        "
                >
                  FACULTY
                </div>
              </div>

              {/* Content */}
              <div
                className="
        flex
        flex-col
        flex-1
        px-5
        py-2
        overflow-y-auto
        scrollbar-hide
      "
              >
                {/* Name */}
                <h3
                  className="
          text-[18px]
          font-black
          tex t-[#0f3460]
          leading-tight
        "
                >
                  {teacher.name}
                </h3>

                {/* Role */}
                <p
                  className="
          mt-1
          text-[#b8860b]
          text-[13px]
          font-bold
          leading-relaxed
        "
                >
                  {teacher.role}
                </p>

                {/* Divider */}
                <div
                  className="
          mt-2
          h-[1px]
          bg-gradient-to-r
          from-[#d8c3a5]
          via-[#efe6d8]
          to-transparent
        "
                />

                {/* Experience + Qualification */}
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <p
                      className="
              text-[10px]
              uppercase
              tracking-[0.25em]
              text-gray-400
              font-bold
            "
                    >
                      Experience
                    </p>

                    <p
                      className="
              mt-2
              text-[#0f3460]
              font-extrabold
              text-base
            "
                    >
                      {teacher.experience}
                    </p>
                  </div>

                  <div>
                    <p
                      className="
              text-[10px]
              uppercase
              tracking-[0.25em]
              text-gray-400
              font-bold
            "
                    >
                      Qualification
                    </p>

                    <p
                      className="
              mt-2
              text-sm
              text-gray-700
              leading-relaxed
            "
                    >
                      {teacher.education || "Professional Trainer"}
                    </p>
                  </div>
                </div>

                {/* About */}
                <div className="mt-5">
                  <p
                    className="
            text-[10px]
            uppercase
            tracking-[0.25em]
            text-gray-400
            font-bold
          "
                  >
                    About
                  </p>

                  <p
                    className="
            mt-2
            text-sm
            text-gray-600
            leading-6
          "
                  >
                    {teacher.about ||
                      (teacher.role
                        ? `${teacher.role} with practical industry experience and student-focused training approach.`
                        : "Experienced trainer dedicated to helping students build strong career skills.")}
                  </p>
                </div>

                {/* Bottom Spacer */}
                <div className="mt-auto pt-4" />
              </div>

              {/* Fixed Bottom Accent */}
              <div
                className="
        h-[4px]
        w-full
        mt-auto
        bg-gradient-to-r
        from-[#0f3460]
        via-[#b8860b]
        to-[#0f3460]
      "
              />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TeachersSection;
