import { BookOpen, Target, Eye, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";

const AboutSection = () => {
  const { t } = useTranslation();

  return (
    <section id="about" className="section-padding bg-background">
      <div className="container mx-auto">
        <div className="text-center mb-14">
          <span className="inline-block bg-secondary/10 text-secondary font-heading font-bold text-xs uppercase tracking-widest px-4 py-1.5 rounded-full">
            {t("About Us")}
          </span>
          <h2 className="font-heading font-extrabold text-3xl md:text-4xl text-foreground mt-4">
            {t("Shaping Futures Since Day One")}
          </h2>
          <div className="w-16 h-1 bg-accent mx-auto mt-4 rounded-full" />
        </div>

        {/* Two-column layout */}
        <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
          <div>
            <h3 className="font-heading font-bold text-2xl text-primary mb-4">
              {t("Who We Are")}
            </h3>
            <p className="text-muted-foreground text-base leading-relaxed mb-4">
              <strong className="text-foreground">
                {t("Sir Chhotu Ram Education Pvt. Ltd.")}
              </strong>{" "}
              {t("is a premier institute dedicated to providing quality computer education and skill development training. We bridge the gap between education and employment through industry-relevant courses.")}
            </p>
            <p className="text-muted-foreground text-base leading-relaxed mb-6">
              {t("With 10+ years of experience, 5000+ trained students, and a 95% placement rate, we are the most trusted IT training institute in the region.")}
            </p>
            <div className="flex flex-wrap gap-3">
              {[
                t("Government Recognized"),
                t("ISO Certified"),
                t("Experienced Faculty"),
                t("Modern Labs"),
              ].map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 bg-accent/10 text-accent-foreground px-4 py-2 rounded-full text-sm font-semibold border border-accent/20"
                >
                  <Shield className="w-3.5 h-3.5 text-accent" /> {tag}
                </span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-primary rounded-2xl p-6 text-primary-foreground text-center hover-popup-subtle">
              <div className="font-heading font-extrabold text-3xl">10+</div>
              <p className="text-primary-foreground/70 text-sm mt-1">
                {t("Years Experience")}
              </p>
            </div>
            <div className="bg-secondary rounded-2xl p-6 text-secondary-foreground text-center hover-popup-subtle">
              <div className="font-heading font-extrabold text-3xl">5000+</div>
              <p className="text-secondary-foreground/70 text-sm mt-1">
                {t("Students Trained")}
              </p>
            </div>
            <div className="bg-accent rounded-2xl p-6 text-accent-foreground text-center hover-popup-subtle">
              <div className="font-heading font-extrabold text-3xl">95%</div>
              <p className="text-accent-foreground/70 text-sm mt-1">
                {t("Placement Rate")}
              </p>
            </div>
            <div className="bg-primary-dark rounded-2xl p-6 text-primary-foreground text-center hover-popup-subtle">
              <div className="font-heading font-extrabold text-3xl">20+</div>
              <p className="text-primary-foreground/70 text-sm mt-1">
                {t("Courses Available")}
              </p>
            </div>
          </div>
        </div>

        {/* Mission / Vision / Values */}
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: Target,
              title: t("Our Mission"),
              desc: t("To empower youth with practical IT skills and vocational training that leads to employment and entrepreneurship."),
              color: "bg-primary",
            },
            {
              icon: Eye,
              title: t("Our Vision"),
              desc: t("To become the most trusted skill development institute producing industry-ready professionals."),
              color: "bg-secondary",
            },
            {
              icon: BookOpen,
              title: t("Our Values"),
              desc: t("Quality education, student-first approach, industry partnerships, and commitment to excellence."),
              color: "bg-accent",
            },
          ].map((item) => (
            <div key={item.title} className="bg-card border border-border p-8 rounded-3xl hover-popup-subtle transition-all">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${item.color}`}>
                <item.icon className="w-7 h-7 text-white" />
              </div>
              <h4 className="font-heading font-bold text-xl text-foreground mb-3">{item.title}</h4>
              <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
