import React, { useState, useEffect } from 'react';
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { 
  CheckCircle2, 
  MapPin, 
  IndianRupee, 
  Monitor, 
  Users, 
  GraduationCap,
  Building2,
  Cpu,
  Wifi,
  Zap,
  ArrowRight,
  Download
} from "lucide-react";
import { Hero, Section, CTABanner } from "@/components/franchise/FranchiseComponents";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const RequirementCard = ({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) => {
  const { t } = useTranslation();
  return (
    <div className="p-10 bg-white border border-slate-100 rounded-[40px] shadow-sm hover:shadow-2xl hover:border-primary/20 transition-all group h-full flex flex-col">
      <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-8 group-hover:bg-primary group-hover:text-white transition-all">
        <Icon className="w-8 h-8" />
      </div>
      <h3 className="text-2xl font-bold mb-4 tracking-tight">{t(title)}</h3>
      <p className="text-slate-600 font-medium leading-relaxed">
        {t(desc)}
      </p>
    </div>
  );
};

const FranchiseRequirementsPage = () => {
  const { t } = useTranslation();
  const [feeStructureUrl, setFeeStructureUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchFeeStructure = async () => {
      try {
        const res = await apiFetch("/api/cms?category=download&active_only=true");
        const data = await res.json();
        if (Array.isArray(data)) {
          const feeDoc = data.find(item => 
            item.title.toLowerCase().includes("fee structure") || 
            item.title.toLowerCase().includes("investment")
          );
          if (feeDoc) {
            setFeeStructureUrl(feeDoc.image_url);
          }
        }
      } catch (err) {
        console.error("Failed to fetch fee structure", err);
      }
    };
    fetchFeeStructure();
  }, []);

  const handleDownload = () => {
    if (feeStructureUrl) {
      window.open(feeStructureUrl, "_blank");
    } else {
      toast.error(t("Fee structure document not found. Please contact support."));
    }
  };

  const requirements = [
    {
      title: t("Minimum Space"),
      desc: t("500-1000 Sq. Ft. built-up area at a prime location in the city."),
      icon: Monitor
    },
    {
      title: t("Computer Lab"),
      desc: t("Minimum 5-10 latest configuration systems with internet connectivity."),
      icon: Cpu
    },
    {
      title: t("Classroom"),
      desc: t("Dedicated theory classroom with comfortable seating and board."),
      icon: GraduationCap
    },
    {
      title: t("Front Office"),
      desc: t("Reception area with branding and student inquiry desk."),
      icon: Building2
    },
    {
      title: t("Faculty"),
      desc: t("Trained and certified instructors for respective courses."),
      icon: Users
    },
    {
      title: t("Electricity"),
      desc: t("Reliable power backup (UPS/Inverter) for uninterrupted learning."),
      icon: Zap
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      
      <main className="flex-grow">
        <Hero 
          title={t("What You Need to Get Started")}
          subtitle={t("A clear roadmap of the physical and financial assets required to launch a premium SCRE center in your city.")}
          badge={t("Ready to Launch Checklist")}
        />

        <Section 
          title={t("Prerequisites for Success")}
          subtitle={t("To ensure the highest standard of technical education, SCRE maintains strict quality guidelines for all training centers.")}
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {requirements.map((req, idx) => (
              <RequirementCard key={idx} {...req} />
            ))}
          </div>
        </Section>

        <Section title={t("Financial Investment")} className="bg-slate-950 text-white" dark>
          <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-16 items-center">
            <div className="flex-1 space-y-8">
              <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center">
                <IndianRupee className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-tight">
                {t("Transparent")}<br/>{t("Budgeting")}
              </h2>
              <p className="text-lg text-slate-400 font-medium leading-relaxed">
                {t("Starting an IT center requires capital for setup, branding, and initial marketing. We offer three flexible models to suit your budget.")}
              </p>
              <div className="flex flex-col gap-4">
                <div className="p-6 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between">
                  <span className="font-bold text-slate-300">{t("Basic Model (Village)")}</span>
                  <span className="text-xl font-black text-primary">₹1.5L - 3L</span>
                </div>
                <div className="p-6 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between">
                  <span className="font-bold text-slate-300">{t("Standard Model (Town)")}</span>
                  <span className="text-xl font-black text-primary">₹3L - 7L</span>
                </div>
                <div className="p-6 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between">
                  <span className="font-bold text-slate-300">{t("Premium Model (City)")}</span>
                  <span className="text-xl font-black text-primary">₹7L - 15L</span>
                </div>
              </div>
            </div>
            <div className="flex-1 p-12 bg-primary rounded-[40px] relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
              <h3 className="text-3xl font-bold mb-6">{t("Investment Includes:")}</h3>
              <ul className="space-y-4 mb-10">
                {[
                  t("Brand Authorization License"),
                  t("ERP Software Access (Lifetime)"),
                  t("Marketing Design Assets"),
                  t("Initial Staff Training"),
                  t("Center Interior Guidance"),
                  t("National Job Portal Access")
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 font-bold text-sm uppercase tracking-widest text-primary-foreground/90">
                    <CheckCircle2 className="w-5 h-5 text-white" /> {item}
                  </li>
                ))}
              </ul>
              <button 
                onClick={handleDownload}
                className="w-full py-5 bg-white text-primary font-black uppercase text-xs tracking-widest rounded-2xl hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
              >
                {feeStructureUrl ? t("Download Fee Structure") : t("Fee Structure Not Available")} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </Section>

        <CTABanner 
          title={t("Meet the Requirements?")}
          subtitle={t("If you have the space and the vision, we have the system. Apply today to secure your territory.")}
        />
      </main>

      <Footer />
    </div>
  );
};

export default FranchiseRequirementsPage;
