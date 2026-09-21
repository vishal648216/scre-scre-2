import React from 'react';
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { 
  Zap, 
  ShieldCheck, 
  TrendingUp, 
  Users, 
  Cpu, 
  Award,
  CheckCircle2,
  XCircle,
  BarChart3,
  Clock,
  ThumbsUp
} from "lucide-react";
import { Hero, Section, CTABanner } from "@/components/franchise/FranchiseComponents";
import { useTranslation } from "react-i18next";

const StatCard = ({ val, label }: { val: string, label: string }) => {
  const { t } = useTranslation();
  return (
    <div className="p-8 bg-white rounded-[32px] border border-slate-100 shadow-sm text-center group hover:border-primary/20 transition-all">
      <p className="text-4xl md:text-5xl font-black text-primary mb-2 group-hover:scale-110 transition-transform">{t(val)}</p>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{t(label)}</p>
    </div>
  );
};

const ComparisonTable = () => {
  const { t } = useTranslation();
  return (
    <div className="max-w-4xl mx-auto overflow-hidden rounded-[40px] border border-slate-200 shadow-2xl bg-white">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-950 text-white">
            <th className="p-8 text-lg font-bold">{t("Feature / Advantage")}</th>
            <th className="p-8 text-lg font-bold text-center bg-primary">SCREduc</th>
            <th className="p-8 text-lg font-bold text-center opacity-50">{t("Local Brands")}</th>
          </tr>
        </thead>
        <tbody className="font-medium">
          {[
            { feature: t("Cloud ERP & Automation"), us: true, them: false },
            { feature: t("ISO 9001:2015 Certification"), us: true, them: t("Optional") },
            { feature: t("100+ Industry Courses"), us: true, them: false },
            { feature: t("National Placement Portal"), us: true, them: false },
            { feature: t("Marketing & Branding Kit"), us: true, them: true },
            { feature: t("Low Royalty Structure"), us: true, them: false },
          ].map((row, i) => (
            <tr key={i} className="border-b border-slate-100 last:border-0">
              <td className="p-6 md:p-8 text-slate-700">{row.feature}</td>
              <td className="p-6 md:p-8 bg-primary/5">
                <div className="flex justify-center">
                  {row.us === true ? <CheckCircle2 className="w-6 h-6 text-primary" /> : <span className="text-sm font-bold text-slate-400">{row.us}</span>}
                </div>
              </td>
              <td className="p-6 md:p-8 opacity-50">
                <div className="flex justify-center">
                  {row.them === true ? <CheckCircle2 className="w-6 h-6 text-slate-400" /> : row.them === false ? <XCircle className="w-6 h-6 text-slate-300" /> : <span className="text-sm font-bold text-slate-400">{row.them}</span>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const FranchiseWhyUsPage = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      
      <main className="flex-grow">
        <Hero 
          title={t("Empowering Partners, Transforming Lives")}
          subtitle={t("Join SCRE, the fastest growing network of skill-based computer training centers in India.")}
          badge={t("Partner with Excellence")}
        />

        {/* Stats Section */}
        <section className="py-12 -mt-16 relative z-20">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              <StatCard val="50+" label={t("Active Centers")} />
              <StatCard val="10K+" label={t("Students Trained")} />
              <StatCard val="10+" label={t("Years Experience")} />
              <StatCard val="98%" label={t("Success Rate")} />
            </div>
          </div>
        </section>

        {/* Core Advantages */}
        <Section 
          title={t("Engineered for Growth")}
          subtitle={t("Our ecosystem is built on three pillars: Advanced Technology, Industry-Aligned Content, and Unmatched Support.")}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              { 
                icon: Cpu, 
                title: t("Automation-First"), 
                desc: t("Our custom ERP handles everything from inquiry to certification, reducing your manual workload by 80%.") 
              },
              { 
                icon: Award, 
                title: t("Premium Content"), 
                desc: t("High-quality video lectures, lab manuals, and e-books updated every session to stay ahead of the curve.") 
              },
              { 
                icon: TrendingUp, 
                title: t("Profit Protection"), 
                desc: t("We offer territory exclusivity and a low-royalty model to ensure our partners remain the most profitable in their city.") 
              }
            ].map((item, i) => (
              <div key={i} className="flex flex-col">
                <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
                  <item.icon className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold mb-4 tracking-tight">{item.title}</h3>
                <p className="text-slate-600 font-medium leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Comparison Section */}
        <Section 
          title={t("The Smart Comparison")}
          subtitle={t("See how we stack up against traditional computer center models.")}
          className="bg-slate-50"
        >
          <ComparisonTable />
        </Section>

        {/* Testimonial / Success Proof */}
        <Section 
          title={t("Partner Success Stories")}
          subtitle={t("Real feedback from entrepreneurs who transformed their local communities with SCREduc.")}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {[
              {
                name: t("Rajesh Kumar"),
                center: t("Jind Center"),
                quote: t("Starting a center with SCREduc was the best decision. The ERP made my life so easy that I could focus entirely on marketing and growth. We reached 100 students in just 4 months.")
              },
              {
                name: t("Meenakshi Sharma"),
                center: t("Rohtak Hub"),
                quote: t("The brand value and government certifications helped us gain trust instantly. Parents in our city now recognize SCREduc as the standard for quality IT training.")
              }
            ].map((t, i) => (
              <div key={i} className="p-10 bg-white border border-slate-100 rounded-[40px] shadow-lg relative overflow-hidden group">
                <ThumbsUp className="absolute top-8 right-10 w-12 h-12 text-slate-50 group-hover:text-primary/10 transition-colors" />
                <p className="text-slate-600 font-medium italic mb-8 relative z-10 leading-relaxed">"{t.quote}"</p>
                <div className="relative z-10">
                  <p className="font-bold text-slate-900">{t.name}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary">{t.center}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <CTABanner 
          title={t("Ready to Join the Leaders?")}
          subtitle={t("Don't just open a computer center. Build a scalable education business with India's most advanced network.")}
        />
      </main>

      <Footer />
    </div>
  );
};

export default FranchiseWhyUsPage;
