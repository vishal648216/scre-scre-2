import React from 'react';
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { 
  Building2, 
  HelpCircle, 
  CheckCircle2, 
  Handshake, 
  Settings, 
  TrendingUp,
  FileEdit,
  Award,
  Users,
  Zap,
  Globe,
  BarChart3,
  Cpu,
  ShieldCheck,
  ChevronRight,
  ArrowRight
} from "lucide-react";
import { Hero, Section, Card, CTABanner } from "@/components/franchise/FranchiseComponents";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const FranchisePage = () => {
  const { t } = useTranslation();
  const benefits = [
    {
      title: t("Proven Business Model"),
      desc: t("Skip the trial-and-error. Our system is built on years of successful center operations."),
      icon: TrendingUp
    },
    {
      title: t("Premium Branding"),
      desc: t("Leverage a recognized name in IT education that parents and students already trust."),
      icon: Award
    },
    {
      title: t("Low Capital Entry"),
      desc: t("Start with a minimal investment while maximizing your local market reach."),
      icon: BarChart3
    }
  ];

  const whatWeProvide = [
    {
      title: t("Cloud-Based ERP"),
      desc: t("Manage admissions, fees, attendance, and exams with our powerful automation suite."),
      icon: Cpu
    },
    {
      title: t("Modern Curriculum"),
      desc: t("Access 100+ industry-aligned courses ranging from basic IT to advanced AI."),
      icon: Zap
    },
    {
      title: t("Marketing Kit"),
      desc: t("Full set of digital and print assets to launch your center with maximum impact."),
      icon: Globe
    },
    {
      title: t("Operational Support"),
      desc: t("Dedicated account managers to help you scale and solve day-to-day challenges."),
      icon: Settings
    }
  ];

  const steps = [
    { number: "01", title: t("Submit Inquiry"), desc: t("Fill out the application form with your location and vision.") },
    { number: "02", title: t("Initial Consultation"), desc: t("Our experts will discuss the potential and center models with you.") },
    { number: "03", title: t("Center Setup"), desc: t("We help you design the space and install the required infrastructure.") },
    { number: "04", title: t("Launch & Scale"), desc: t("Start admissions with our marketing support and begin your journey.") }
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      
      <main className="flex-grow">
        {/* Hero Section */}
        <Hero 
          title={t("Build Your Own IT Education Empire")}
          subtitle={t("Join India's most innovative franchise network. We provide the tech, the brand, and the blueprint—you lead the growth in your city.")}
          badge={t("Now Partnering for 2026-27")}
        />

        {/* Benefits Section */}
        <Section 
          title={t("Why Entrepreneurs Choose Us")}
          subtitle={t("We don't just sell franchises; we build long-term partnerships that prioritize your growth and local impact.")}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {benefits.map((benefit, idx) => (
              <div key={idx} className="p-10 bg-slate-50 rounded-[32px] border border-slate-100 hover:border-primary/20 transition-all group">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-8 group-hover:scale-110 transition-transform">
                  <benefit.icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-4 tracking-tight">{benefit.title}</h3>
                <p className="text-slate-600 font-medium leading-relaxed">{benefit.desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* What We Provide Section */}
        <Section 
          title={t("Everything You Need to Succeed")}
          subtitle={t("From tech infrastructure to course materials, we've got you covered every step of the way.")}
          className="bg-slate-950 text-white"
          dark
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {whatWeProvide.map((item, idx) => (
              <div key={idx} className="p-8 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-all group">
                <div className="w-12 h-12 bg-primary/20 text-primary rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-white transition-all">
                  <item.icon className="w-6 h-6" />
                </div>
                <h4 className="text-xl font-bold mb-3">{item.title}</h4>
                <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Earning Potential Section */}
        <Section 
          title={t("Projected Earning Potential")}
          subtitle={t("A transparent look at how our centers generate consistent, scalable revenue.")}
        >
          <div className="max-w-5xl mx-auto bg-white border border-slate-200 rounded-[40px] overflow-hidden shadow-2xl flex flex-col lg:flex-row">
            <div className="p-12 lg:p-16 flex-1 bg-slate-50">
              <h4 className="text-sm font-bold text-primary uppercase tracking-widest mb-4">{t("Sample Monthly ROI")}</h4>
              <p className="text-slate-600 mb-8 font-medium">{t("Based on a Standard Center model with 100 active students.")}</p>
              <div className="space-y-6">
                {[
                  { label: t("Course Fees Revenue"), val: "₹1,50,000" },
                  { label: t("Exam & Cert Fees"), val: "₹30,000" },
                  { label: t("Book & Kit Sales"), val: "₹20,000" },
                ].map((row, i) => (
                  <div key={i} className="flex justify-between items-center pb-4 border-b border-slate-200">
                    <span className="font-bold text-slate-700">{row.label}</span>
                    <span className="font-black text-slate-900">{row.val}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-4">
                  <span className="text-xl font-black text-slate-900 uppercase">{t("Gross Profit")}</span>
                  <span className="text-3xl font-black text-primary">₹2,00,000+</span>
                </div>
              </div>
            </div>
            <div className="p-12 lg:p-16 flex-1 bg-primary text-white flex flex-col justify-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
              <h4 className="text-3xl font-bold mb-6 relative z-10">{t("High Growth, Low Royalty")}</h4>
              <p className="text-primary-foreground/80 mb-10 leading-relaxed font-medium relative z-10">
                {t("Unlike other networks, we believe in keeping our franchise owners profitable. Our royalty structure is the most competitive in the industry.")}
              </p>
              <Link 
                to="/franchise/investment" 
                className="inline-flex items-center gap-2 font-bold uppercase tracking-widest text-xs py-4 px-8 bg-white text-primary rounded-xl hover:bg-slate-50 transition-all self-start relative z-10"
              >
                {t("View Detailed Investment Plans")} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </Section>

        {/* Process Section */}
        <Section 
          title={t("Your Journey to Leadership")}
          subtitle={t("Our streamlined onboarding process gets your center up and running in as little as 30 days.")}
          className="bg-slate-50"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            {/* Connecting Line (Desktop) */}
            <div className="hidden md:block absolute top-12 left-0 w-full h-0.5 bg-slate-200 -z-0" />
            
            {steps.map((step, idx) => (
              <div key={idx} className="relative z-10 text-center md:text-left">
                <div className="w-24 h-24 bg-white border-4 border-slate-100 rounded-full flex items-center justify-center mx-auto md:mx-0 mb-8 shadow-xl text-primary text-2xl font-black">
                  {step.number}
                </div>
                <h4 className="text-xl font-bold mb-4">{step.title}</h4>
                <p className="text-slate-600 text-sm font-medium leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </Section>

        <CTABanner />
      </main>

      <Footer />
    </div>
  );
};

export default FranchisePage;
