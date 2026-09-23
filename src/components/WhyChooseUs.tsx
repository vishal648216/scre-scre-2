import { Award, Users, Laptop, BookCheck, Headphones, Building } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const WhyChooseUs = () => {
  const { t } = useTranslation();

  const benefits = [
    { icon: Award, title: t("Certified Courses"), desc: t("Industry-recognized certifications that boost your resume and career."), num: "01" },
    { icon: Users, title: t("Expert Faculty"), desc: t("Experienced trainers with real industry exposure and teaching excellence."), num: "02" },
    { icon: Laptop, title: t("Practical Training"), desc: t("Hands-on lab sessions with real-world projects and assignments."), num: "03" },
    { icon: BookCheck, title: t("Updated Curriculum"), desc: t("Regularly updated syllabus aligned with current industry demands."), num: "04" },
    { icon: Headphones, title: t("Placement Support"), desc: t("100% placement assistance with interview prep and job referrals."), num: "05" },
    { icon: Building, title: t("Modern Infrastructure"), desc: t("AC labs, high-speed internet, and latest software tools."), num: "06" },
  ];

  return (
    <section className="relative py-24 bg-primary overflow-hidden">

      {/* Subtle Background Shapes */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-secondary/10 rounded-full blur-3xl"></div>

      <div className="container mx-auto px-6 relative z-10">

        <div className="grid lg:grid-cols-2 gap-16 items-start">

          {/* LEFT CONTENT SIDE */}
          <div>
            <span className="inline-block bg-accent/20 text-accent text-xs uppercase tracking-widest font-bold px-4 py-1.5 rounded-full">
              {t("Why Choose Us")}
            </span>

            <h2 className="text-4xl md:text-5xl font-extrabold text-primary-foreground mt-6 leading-tight">
              {t("We Don’t Just Teach —")} <br />
              <span className="text-accent">{t("We Build Careers")}</span>
            </h2>

            <p className="text-primary-foreground/70 mt-6 leading-relaxed">
              {t("Our mission is to provide practical knowledge, industry exposure, and complete placement support so students can confidently enter the competitive job market.")}
            </p>

            {/* PROFESSIONAL POINTS */}
            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2.5 h-2.5 bg-accent rounded-full mt-2 shrink-0"></div>
                <p className="text-primary-foreground/80 text-sm leading-relaxed">
                  {t("Real-world project based training instead of only theoretical classes.")}
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-2.5 h-2.5 bg-accent rounded-full mt-2 shrink-0"></div>
                <p className="text-primary-foreground/80 text-sm leading-relaxed">
                  {t("Dedicated placement cell with interview preparation & resume guidance.")}
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-2.5 h-2.5 bg-accent rounded-full mt-2 shrink-0"></div>
                <p className="text-primary-foreground/80 text-sm leading-relaxed">
                  {t("Updated curriculum aligned with current industry tools & technologies.")}
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-2.5 h-2.5 bg-accent rounded-full mt-2 shrink-0"></div>
                <p className="text-primary-foreground/80 text-sm leading-relaxed">
                  {t("Personalized mentoring and doubt-clearing support throughout the course.")}
                </p>
              </div>
            </div>

            <Link
              to="/courses"
              className="inline-block mt-10 bg-accent text-accent-foreground font-bold px-10 py-4 rounded-xl hover-popup shadow-lg"
            >
              {t("Explore Courses")}
            </Link>
          </div>

          {/* RIGHT SIDE FEATURES */}
          <div className="relative">

            {/* Vertical Line */}
            <div className="absolute left-6 top-0 bottom-0 w-px bg-primary-foreground/20"></div>

            <div className="space-y-10">
              {benefits.map((b, index) => (
                <div
                  key={b.title}
                  className="relative pl-16 group hover-popup-subtle p-4 rounded-2xl bg-white/5 backdrop-blur-sm transition-all"
                >
                  {/* Circle Dot */}
                  <div className="absolute left-0 top-2 w-12 h-12 rounded-full bg-accent flex items-center justify-center shadow-lg">
                    <b.icon className="w-6 h-6 text-accent-foreground" />
                  </div>

                  {/* Background Large Number */}
                  <span className="absolute right-0 top-0 text-6xl font-extrabold text-primary-foreground/5">
                    {b.num}
                  </span>

                  <h3 className="text-lg font-bold text-primary-foreground">
                    {b.title}
                  </h3>

                  <p className="text-primary-foreground/60 text-sm mt-2 leading-relaxed max-w-md">
                    {b.desc}
                  </p>

                  {/* Hover Effect */}
                  <div className="mt-4 h-px w-0 bg-accent transition-all duration-500 group-hover:w-24"></div>
                </div>
              ))}
            </div>

          </div>

        </div>
      </div>
    </section>
  );
};

export default WhyChooseUs;