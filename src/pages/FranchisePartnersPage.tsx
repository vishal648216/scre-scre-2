import React from 'react';
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { 
  ShieldCheck, 
  Award, 
  Globe, 
  Cpu, 
  CheckCircle2,
  Handshake
} from "lucide-react";
import { Hero, Section } from "@/components/franchise/FranchiseComponents";
import { useTranslation } from "react-i18next";

import { normalizeAssetUrl } from '@/lib/utils';

const PartnerCard = ({ name, type, image }: { name: string, type: string, image?: string }) => {
  const { t } = useTranslation();
  return (
    <div className="p-8 bg-white border border-slate-100 rounded-[32px] shadow-sm hover:shadow-xl hover:border-primary/20 transition-all group flex flex-col items-center text-center">
      <div className="w-24 h-24 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-primary/5 transition-colors overflow-hidden p-4">
        {image ? (
          <img
            src={normalizeAssetUrl(image)}
            alt={name}
            className="w-full h-full object-contain filter grayscale group-hover:grayscale-0 transition-all duration-500"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <Handshake className="w-10 h-10 text-slate-300 group-hover:text-primary transition-colors" />
        )}
      </div>
      <h4 className="text-lg font-bold text-slate-900 mb-1 tracking-tight">{t(name)}</h4>
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{t(type)}</span>
    </div>
  );
};

const FranchisePartnersPage = () => {
  const { t } = useTranslation();
  const categories = [
    {
      title: t("Government Accreditations"),
      desc: t("Our certifications and registrations ensure that your center operates under valid legal frameworks and provides recognized diplomas."),
      partners: [
        { name: "MSME", type: "Govt. of India" },
        { name: "ISO 9001:2015", type: "Quality Management" },
        { name: "NITI Aayog", type: "Strategic Partner" },
        { name: "Ministry of Corp. Affairs", type: "Registered Entity" }
      ]
    },
    {
      title: t("Technology Partners"),
      desc: t("We collaborate with global tech giants to provide authentic software access and industry-aligned technical training materials."),
      partners: [
        { name: "Microsoft", type: "Learning Partner" },
        { name: "Google Cloud", type: "Infrastructure" },
        { name: "AWS Education", type: "Cloud Partner" },
        { name: "Adobe", type: "Creative Suite" }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      
      <main className="flex-grow">
        <Hero 
          title={t("Strategic Alliances for Your Success")}
          subtitle={t("We partner with the world's leading organizations to give your center a competitive edge and your students global recognition.")}
          badge={t("Our Global Ecosystem")}
        />

        <Section 
          title={t("Trust & Credibility")}
          subtitle={t("SCREduc is backed by industry-standard certifications that validate our commitment to quality IT education.")}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: ShieldCheck, title: t("Valid Certifications"), desc: t("Every certificate issued by your center is backed by our ISO and MSME registrations.") },
              { icon: Award, title: t("Industry Standard"), desc: t("Our curriculum follows the latest NSQF guidelines for skill-based education.") },
              { icon: Globe, title: t("Pan-India Network"), desc: t("Join a network that is recognized by recruiters and companies across the country.") }
            ].map((item, i) => (
              <div key={i} className="p-10 bg-slate-50 rounded-[40px] border border-slate-100 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-8">
                  <item.icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-4">{item.title}</h3>
                <p className="text-slate-600 font-medium text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {categories.map((cat, idx) => (
          <Section 
            key={idx} 
            title={cat.title} 
            subtitle={cat.desc}
            className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-10">
              {cat.partners.map((partner, pIdx) => (
                <PartnerCard key={pIdx} {...partner} />
              ))}
            </div>
          </Section>
        ))}

        <section className="py-24 bg-slate-950 text-white overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-full bg-[grid-white/5] [mask-image:radial-gradient(ellipse_at_center,white,transparent)]" />
          <div className="container mx-auto px-4 relative z-10 text-center">
            <h2 className="text-3xl md:text-5xl font-black mb-8 uppercase tracking-tighter">{t("Become a Strategic Partner")}</h2>
            <p className="text-slate-400 max-w-2xl mx-auto mb-12 font-medium leading-relaxed">
              {t("Are you a technology provider or education board looking to expand your reach? Let's collaborate to build the future of IT education.")}
            </p>
            <button className="px-12 py-5 bg-primary text-white font-bold rounded-2xl hover:bg-primary/90 transition-all shadow-2xl shadow-primary/20">
              {t("Propose Partnership")}
            </button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default FranchisePartnersPage;
