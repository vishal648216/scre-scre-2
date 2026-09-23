import React from 'react';
import { LucideIcon, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { usePublicSystemSettings } from "@/hooks/usePublicSystemSettings";

interface SectionProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  dark?: boolean;
}

export const Section = ({ children, className, title, subtitle, dark }: SectionProps) => {
  const { t } = useTranslation();
  return (
    <section className={cn("py-24 px-4 sm:px-6 lg:px-8", dark ? "bg-slate-950 text-white" : "bg-white text-slate-900", className)}>
      <div className="max-w-7xl mx-auto">
        {(title || subtitle) && (
          <div className="mb-20 text-center max-w-3xl mx-auto">
            {title && (
              <h2 className="text-3xl md:text-5xl font-extrabold mb-6 tracking-tight leading-tight">
                {t(title)}
              </h2>
            )}
            {subtitle && (
              <p className={cn("text-lg font-medium leading-relaxed", dark ? "text-slate-400" : "text-slate-600")}>
                {t(subtitle)}
              </p>
            )}
          </div>
        )}
        {children}
      </div>
    </section>
  );
};

interface CardProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  className?: string;
  href?: string;
}

export const Card = ({ icon: Icon, title, description, className, href }: CardProps) => {
  const { t } = useTranslation();
  const CardContent = (
    <div className={cn("group p-8 bg-white border border-slate-200 rounded-3xl shadow-sm hover:shadow-2xl hover:border-primary/50 transition-all duration-500 flex flex-col h-full relative overflow-hidden", className)}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 transition-transform duration-700 group-hover:scale-150" />

      {Icon && (
        <div className="w-14 h-14 bg-primary/10 text-primary flex items-center justify-center mb-6 rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-500 transform group-hover:-translate-y-1">
          <Icon className="w-7 h-7" />
        </div>
      )}
      <h3 className="text-xl font-bold mb-3 tracking-tight group-hover:text-primary transition-colors">{t(title)}</h3>
      <p className="text-slate-600 leading-relaxed font-medium text-sm flex-grow">
        {t(description)}
      </p>

      {href && (
        <div className="mt-6 flex items-center text-xs font-bold text-primary group-hover:translate-x-1 transition-transform duration-300">
          {t("Explore Details")} <ChevronRight className="w-4 h-4 ml-1" />
        </div>
      )}
    </div>
  );

  return href ? <Link to={href}>{CardContent}</Link> : CardContent;
};

interface HeroProps {
  title: string;
  subtitle: string;
  badge?: string;
  ctaText?: string;
  ctaLink?: string;
  image?: string;
}

export const Hero = ({ title, subtitle, badge = "Franchise Opportunity", ctaText = "Apply Now", ctaLink = "/franchise/apply" }: HeroProps) => {
  const { t } = useTranslation();
  const { data: settings } = usePublicSystemSettings();
  return (
    <div className="relative pt-48 pb-32 px-4 sm:px-6 lg:px-8 bg-slate-950 text-white overflow-hidden">
      {/* Modern mesh gradient / grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-primary/20 via-primary/5 to-transparent blur-[120px]" />
      <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/30 rounded-full blur-[120px]" />

      <div className="max-w-7xl mx-auto relative z-10 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-primary text-xs font-bold uppercase tracking-widest mb-10 animate-in fade-in slide-in-from-top-4 duration-500 shadow-xl shadow-primary/5">
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          {t(badge)}
        </div>
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-black mb-8 tracking-tighter leading-[1.1] max-w-5xl mx-auto animate-in fade-in slide-in-from-left-4 duration-700 bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
          {t(title)}
        </h1>
        <p className="text-lg md:text-xl mb-12 text-slate-400 font-medium max-w-3xl mx-auto leading-relaxed animate-in fade-in slide-in-from-left-8 duration-1000">
          {t(subtitle)}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <Link
            to={ctaLink}
            className="w-full sm:w-auto px-10 py-5 bg-primary text-white font-bold rounded-2xl hover:bg-primary/90 transition-all shadow-2xl shadow-primary/20 flex items-center justify-center gap-3 group"
          >
            {t(ctaText)} <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <a
            href={`tel:${(settings?.contact_phone as string) || "+919466317100"}`}
            className="w-full sm:w-auto px-10 py-5 bg-slate-900 border border-slate-800 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-xl"
          >
            {t("Talk to Experts")}
          </a>
        </div>
      </div>
    </div>
  );
};

export const CTABanner = ({
  title = "Start Your Success Story Today",
  subtitle = "Join India's fastest-growing IT education network and transform your career as a business leader."
}) => {
  const { t } = useTranslation();
  const { data: settings } = usePublicSystemSettings();
  return (
    <div className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto bg-primary rounded-[40px] p-12 md:p-20 text-center text-white relative overflow-hidden shadow-2xl shadow-primary/30">
        <div className="absolute top-0 left-0 w-full h-full bg-[grid-white/10] [mask-image:radial-gradient(ellipse_at_center,white,transparent)]" />
        <div className="max-w-4xl mx-auto relative z-10">
          <h2 className="text-4xl md:text-6xl font-black mb-8 tracking-tighter leading-tight">
            {t(title)}
          </h2>
          <p className="text-lg md:text-xl mb-12 text-primary-foreground/80 font-medium max-w-2xl mx-auto leading-relaxed">
            {t(subtitle)}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link
              to="/franchise/apply"
              className="w-full sm:w-auto px-12 py-5 bg-white text-primary font-bold rounded-2xl hover:bg-slate-50 transition-all shadow-2xl"
            >
              {t("Get Started Now")}
            </Link>
            <a
              href={`tel:${(settings?.contact_phone as string) || "+919466317100"}`}
              className="w-full sm:w-auto px-12 py-5 bg-primary-foreground/10 border border-white/20 text-white font-bold rounded-2xl hover:bg-primary-foreground/20 transition-all shadow-2xl"
            >
              {t("Contact Support")}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

