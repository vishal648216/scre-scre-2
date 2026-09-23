import { useEffect, useRef, useState, useMemo } from "react";
import { GraduationCap, BookOpen, Briefcase, Calendar } from "lucide-react";
import { usePublicSystemSettings } from "@/hooks/usePublicSystemSettings";
import { useTranslation } from "react-i18next";

interface SystemSettings {
  students_trained: number;
  courses_offered: number;
  placements_done: number;
  years_experience: number;
}

const useCountUp = (end, duration = 2000, start = false) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!start || !end) return;

    let startTime;

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }, [end, duration, start]);

  return count;
};

const CounterItem = ({ icon: Icon, end, suffix, label, inView }) => {
  const { t } = useTranslation();
  const count = useCountUp(end, 2000, inView);

  return (
    <div className="text-center p-6 relative z-10 hover-popup-subtle rounded-2xl bg-white/5 backdrop-blur-sm">
      <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Icon className="w-8 h-8 text-blue-600" />
      </div>

      <div className="font-extrabold text-4xl md:text-5xl text-white">
        {count}
        {suffix}
      </div>

      <p className="text-white/90 font-semibold mt-2 text-sm">
        {t(label)}
      </p>
    </div>
  );
};

interface CounterSectionProps {
  stats?: {
    totalCenters: number;
    totalStudents: number;
    totalCourses: number;
  };
}

const CounterSection = ({ stats }: CounterSectionProps) => {
  const { t } = useTranslation();
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  const { data: raw } = usePublicSystemSettings();
  const settings = (raw as unknown as SystemSettings | null | undefined) || {
    students_trained: stats?.totalStudents || 5000,
    courses_offered: stats?.totalCourses || 20,
    placements_done: 3000, // Fixed for now or could be added to stats
    years_experience: 10,
  };

  const counters = useMemo(() => [
    { icon: GraduationCap, end: settings.students_trained, suffix: "+", label: t("Students Trained") },
    { icon: BookOpen, end: settings.courses_offered, suffix: "+", label: t("Courses Offered") },
    { icon: Briefcase, end: settings.placements_done, suffix: "+", label: t("Placements Done") },
    { icon: Calendar, end: settings.years_experience, suffix: "+", label: t("Years Experience") },
  ], [settings, t]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold: 0.3 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="py-16 bg-card">
      <div className="container mx-auto px-4">

        <div className="relative overflow-hidden rounded-3xl p-6 md:p-10 shadow-lg">

          {/* Background Image */}
          <img
            src="/images/icc-1.jpg"
            alt="Counter Background"
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Overlay */}
          <div className="absolute inset-0 bg-blue-900/80"></div>

          {/* Grid */}
          <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-6">
            {counters.map((c) => (
              <CounterItem key={c.label} {...c} inView={inView} />
            ))}
          </div>

        </div>
      </div>
    </section>
  );
};

export default CounterSection;