import { useRef, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useHomeData } from "@/hooks/useHomeData";
import { normalizeAssetUrl } from "@/lib/utils";

const StudentSection = () => {
  const { t } = useTranslation();
  const { data: homeData, isLoading } = useHomeData();
  const sliderRef = useRef(null);
  const [isHovering, setIsHovering] = useState(false);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const startScrollLeft = useRef(0);

  const defaultStudents = [
    {
      id: "default-1",
      name: t("Aman Kumar"),
      course: t("Digital Marketing"),
      image: "/images/icc-1.jpg",
      role: t("Alumni"),
      student_description: t("Successfully placed at XYZ Corp"),
    },
    {
      id: "default-2",
      name: t("Priya Sharma"),
      course: t("Graphic Designing"),
      image: "/images/icc-2.jpg",
      role: t("Current Student"),
      student_description: t("Top performer of 2025 batch"),
    },
    {
      id: "default-3",
      name: t("Rahul Singh"),
      course: t("Web Development"),
      image: "/images/icc-3.jpg",
      role: t("Alumni"),
      student_description: t("Freelance developer with 5+ projects"),
    },
    {
      id: "default-4",
      name: t("Neha Verma"),
      course: t("Tally with GST"),
      image: "/images/icc-1.jpg",
      role: t("Current Student"),
      student_description: t("Aspiring accountant"),
    },
    {
      id: "default-5",
      name: t("Rohit Malik"),
      course: t("Computer Basics"),
      image: "/images/icc-2.jpg",
      role: t("Alumni"),
      student_description: t("Working at ABC Ltd"),
    },
    {
      id: "default-6",
      name: t("Sonia Gupta"),
      course: t("Data Entry"),
      image: "/images/icc-3.jpg",
      role: t("Current Student"),
      student_description: t("Quick learner with high accuracy"),
    },
  ];

  const cmsArray = Array.isArray(homeData?.cms) ? homeData.cms : [];

  const safeCmsArray = Array.isArray(cmsArray) ? cmsArray : [];

  const students = safeCmsArray
    .filter((item: any) => item.category === "student" && item.active)
    .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
    .map((item: any, idx: number) => {
      const fallback = defaultStudents[idx % defaultStudents.length];
      return {
        id: item._id?.$oid || item._id || Math.random().toString(),
        name: t(item.title) || fallback.name,
        course: t(item.description || "") || fallback.course,
        image: normalizeAssetUrl(item.image_url) || fallback.image,
        note: t(item.note || ""),
        role: t(item.role || "") || fallback.role,
        student_description: t(item.student_description || "") || fallback.student_description,
        fallbackImage: fallback.image,
      };
    });

  const activeStudents = students.length > 0 ? students : defaultStudents;

  const scroll = (direction) => {
    const slider = sliderRef.current;
    const scrollAmount = 300;

    if (direction === "left") {
      slider.scrollBy({ left: -scrollAmount, behavior: "smooth" });
    } else {
      slider.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!sliderRef.current) return;
    isDragging.current = true;
    if ('touches' in e) {
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
    } else {
      startX.current = (e as React.MouseEvent).pageX - (sliderRef.current as HTMLDivElement).offsetLeft;
    }
    startScrollLeft.current = (sliderRef.current as HTMLDivElement).scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging.current || !sliderRef.current) return;
    let currentX: number;
    if ('touches' in e) {
      currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const deltaX = Math.abs(currentX - startX.current);
      const deltaY = Math.abs(currentY - startY.current);
      if (deltaX > deltaY) {
        e.preventDefault();
        const walk = (currentX - startX.current) * 1.5;
        (sliderRef.current as HTMLDivElement).scrollLeft = startScrollLeft.current - walk;
      }
    } else {
      e.preventDefault();
      currentX = (e as React.MouseEvent).pageX - (sliderRef.current as HTMLDivElement).offsetLeft;
      const walk = (currentX - startX.current) * 1.5;
      (sliderRef.current as HTMLDivElement).scrollLeft = startScrollLeft.current - walk;
    }
  };

  const handleMouseUpOrLeave = () => {
    isDragging.current = false;
  };

  // Auto scroll
  useEffect(() => {
    if (isHovering) return;

    const interval = setInterval(() => {
      const slider = sliderRef.current;

      if (!slider) return;

      if (
        slider.scrollLeft + slider.clientWidth >=
        slider.scrollWidth - 5
      ) {
        slider.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        slider.scrollBy({ left: 300, behavior: "smooth" });
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [isHovering]);

  if (isLoading) {
    return (
      <section className="py-24 bg-muted/30 border-y border-border">
        <div className="container mx-auto px-4 flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  if (!activeStudents || activeStudents.length === 0) return null;

  return (
    <section className="py-24 bg-muted/30 border-y border-border">
      <div className="container mx-auto px-4">

        {/* Heading */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="font-heading font-black text-3xl md:text-5xl text-foreground uppercase tracking-tight mb-4">
              {t("Building Futures at SCRE")}
            </h2>
            <p className="text-muted-foreground max-w-2xl font-medium">
              {t("Students building their future with SCRE through quality education and industry-recognized certifications.")}
            </p>
          </div>

          {/* Arrows */}
          <div className="flex gap-3">
            <button
              onClick={() => scroll("left")}
              className="p-3 rounded-full border border-border hover:bg-primary hover:text-white transition-all duration-300"
            >
              <ChevronLeft size={20} />
            </button>

            <button
              onClick={() => scroll("right")}
              className="p-3 rounded-full border border-border hover:bg-primary hover:text-white transition-all duration-300"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Slider */}
        <div
          ref={sliderRef}
          className="flex gap-6 overflow-x-auto scrollbar-hide scroll-smooth select-none"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          style={{ cursor: isDragging.current ? 'grabbing' : 'grab' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUpOrLeave}
        >
          {activeStudents.map((student: any) => (
            <div
              key={student.id}
              className="flex-shrink-0 w-64 md:w-72 group rounded-2xl overflow-hidden bg-card shadow-md hover:shadow-2xl transition-all duration-300 border border-border hover:-translate-y-1"
            >
              <div className="relative h-48 overflow-hidden">
                <img
                  src={student.image || "/images/icc-2.jpg"}
                  alt={student.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.dataset.fallbackApplied) {
                      target.dataset.fallbackApplied = "true";
                      target.src = "/images/icc-2.jpg";
                    }
                  }}
                />
              </div>

              <div className="p-4">
                <h3 className="font-bold text-lg text-foreground">
                  {student.name}
                </h3>
                {student.role && (
                  <div className="inline-block bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-md mt-2">
                    {student.role}
                  </div>
                )}

                <p className="text-xs text-muted-foreground mt-2 font-medium">
                  {student.course}
                </p>

                {student.student_description && (
                  <p className="text-xs text-foreground/80 mt-2 leading-relaxed">
                    {student.student_description}
                  </p>
                )}

                {student.note && (
                  <p className="text-[10px] text-primary mt-2 font-semibold italic">
                    {student.note}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StudentSection;