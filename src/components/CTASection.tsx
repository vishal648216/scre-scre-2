import { useTranslation } from "react-i18next";
import { usePublicSystemSettings } from "@/hooks/usePublicSystemSettings";

const CTASection = () => {
  const { t } = useTranslation();
  const { data: settings } = usePublicSystemSettings();
  return (
    <section className="py-16 md:py-20 px-4 bg-gradient-to-r from-secondary via-secondary-dark to-secondary relative overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-1/4 w-64 h-64 rounded-full bg-accent" />
        <div className="absolute bottom-0 left-1/4 w-48 h-48 rounded-full bg-primary" />
      </div>
      <div className="container mx-auto text-center relative z-10">
        <h2 className="font-heading font-extrabold text-3xl md:text-4xl text-secondary-foreground mb-4">
          {t("Ready to Start Your Career Journey?")}
        </h2>
        <p className="text-secondary-foreground/80 text-lg mb-8 max-w-xl mx-auto">
          {t("Don't wait! Admissions are open. Enroll now and take the first step towards a successful career in IT.")}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#contact"
            className="bg-accent text-accent-foreground px-10 py-4 rounded-xl font-heading font-bold text-lg hover-popup shadow-lg"
          >
            {t("Apply Now — Free Counseling")}
          </a>
          <a
            href={`tel:${(settings?.contact_phone as string) || "+919466317100"}`}
            className="border-2 border-secondary-foreground/30 text-secondary-foreground px-10 py-4 rounded-xl font-heading font-semibold hover-popup"
          >
            {t("📞 Call Us Now")}
          </a>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
