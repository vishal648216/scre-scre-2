import { Phone, Mail, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePublicSystemSettings } from "@/hooks/usePublicSystemSettings";

const Footer = () => {
  const { t } = useTranslation();
  const { data: settings } = usePublicSystemSettings();

  return (
    <footer className="bg-primary-dark text-primary-foreground">
      <div className="container mx-auto px-4 py-14">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div>
            <div className="flex items-center gap-3 mb-5">
              <img src="/images/logo.jpeg" alt="Logo" className="w-14 h-14 rounded-full border-2 border-accent/30" />
              <div>
                <h3 className="font-heading font-extrabold text-sm uppercase">{t("Sir Chhotu Ram Education Pvt. Ltd.")}</h3>
                <p className="text-primary-foreground/60 text-[10px] uppercase font-bold tracking-widest">{t("IT & Skill Education")}</p>
              </div>
            </div>
            <p className="text-primary-foreground/60 text-sm leading-relaxed">
              {t("Empowering students with industry-ready IT skills and vocational training for a brighter future.")}
            </p>
          </div>

          <div>
            <h4 className="font-heading font-bold text-base mb-5 text-accent">{t("Quick Links")}</h4>
            <ul className="space-y-2.5">
              {[
                { label: t("Home"), href: "/" },
                { label: t("About"), href: "/about" },
                { label: t("Courses"), href: "/courses" },
                { label: t("Franchise"), href: "/franchise" },
                { label: t("Student Zone"), href: "/student-zone" },
                { label: t("Gallery"), href: "/gallery" },
                { label: t("Blog"), href: "/blog" },
                { label: t("Downloads"), href: "/downloads" },
                { label: t("Student Verification"), href: "/verify/student" },
                { label: t("Center Verification"), href: "/verify/center" },
                { label: t("Certificate Verification"), href: "/certificate-verification" },
                { label: t("FAQ"), href: "/faq" },
                { label: t("Shop"), href: "/shop" },
                { label: t("Contact"), href: "/#contact" },
              ].map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-primary-foreground/60 hover:text-accent text-sm transition-colors font-medium">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-bold text-base mb-5 text-accent">{t("Popular Courses")}</h4>
            <ul className="space-y-2.5">
              {[t("DCA"), t("ADCA"), t("Tally with GST"), t("Web Designing"), t("Graphic Designing"), t("Spoken English")].map((c) => (
                <li key={c}>
                  <a href="#courses" className="text-primary-foreground/60 hover:text-accent text-sm transition-colors font-medium">{c}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-bold text-base mb-5 text-accent">{t("Contact Us")}</h4>
            <div className="space-y-3">
              <a href={`tel:${(settings?.contact_phone as string) || "+919466317100"}`} className="flex items-center gap-2 text-primary-foreground/60 hover:text-accent text-sm transition-colors">
                <Phone className="w-4 h-4" /> {(settings?.contact_phone as string) || "+91 94663 17100"}
              </a>
              <a href={`mailto:${(settings?.contact_email as string) || "info@screduc.com"}`} className="flex items-center gap-2 text-primary-foreground/60 hover:text-accent text-sm transition-colors">
                <Mail className="w-4 h-4" /> {(settings?.contact_email as string) || "info@screduc.com"}
              </a>
              <div className="flex items-start gap-2 text-primary-foreground/60 text-sm">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0" /> {t((settings?.contact_address as string) || "# 785/10 Main Bazar Jeweler Market , opposite N.R, Jeweler, Jind, Haryana 126102")}
              </div>
            </div>

            {settings?.contact_map_url && (
              <div className="mt-6 rounded-none overflow-hidden border border-primary-foreground/10 grayscale hover:grayscale-0 transition-all duration-500">
                <iframe
                  title="Location Map"
                  src={settings.contact_map_url as string}
                  width="100%"
                  height="120"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            )}
          </div>

          {/* <div className="mt-8 pt-6 border-t border-primary-foreground/10">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary-foreground/40 mb-3">{t("Technology Partner")}</p>
              <a href="https://codearya.com" target="_blank" rel="noopener noreferrer" className="group block">
                <div className="flex items-center gap-3">
                  <div className="bg-white/5 p-2 rounded-lg group-hover:bg-white/10 transition-colors">
                    <img src="https://codearya.com/favicon.ico" alt="Codearya" className="w-5 h-5 grayscale group-hover:grayscale-0 transition-all" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-primary-foreground/70 group-hover:text-accent transition-colors">CODEARYA PVT. LTD.</span>
                    <span className="block text-[9px] text-primary-foreground/30 uppercase tracking-tighter">www.codearya.com</span>
                  </div>
                </div>
              </a>
            </div> */}
        </div>

        <div className="border-t border-primary-foreground/15 mt-12 pt-8 flex flex-col items-center justify-center gap-3 text-center">
          <p className="text-primary-foreground/50 text-sm font-medium">
            {t("© 2024 Sir Chhotu Ram Education Pvt. Ltd. All rights reserved.")}
          </p>
          {/* <div className="flex items-center gap-2">
            <span className="text-primary-foreground/30 text-[9px] font-bold uppercase tracking-[0.2em]">
              {t("Crafted by")} —
            </span>
            <a 
              href="https://codearya.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-accent hover:text-white text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105"
            >
              CODEARYA PVT. LTD.
            </a>
          </div> */}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
