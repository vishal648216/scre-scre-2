import React from 'react';
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { 
  Briefcase, 
  GraduationCap, 
  Code, 
  Layout, 
  BarChart, 
  Settings, 
  Award, 
  Globe, 
  Users,
  CheckCircle2,
  Cpu
} from "lucide-react";
import { Hero, Section, Card, CTABanner } from "@/components/franchise/FranchiseComponents";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const StudentInternshipPage = () => {
  const { t } = useTranslation();
  const domains = [
    {
      title: t("Web Development"),
      icon: Code,
      desc: t("Learn modern web technologies like React, Node.js, and MongoDB while working on real-world projects.")
    },
    {
      title: t("Graphic Design"),
      icon: Layout,
      desc: t("Master CorelDraw, Photoshop, and UI/UX design principles for digital and print media.")
    },
    {
      title: t("Digital Marketing"),
      icon: BarChart,
      desc: t("Get hands-on experience with SEO, Social Media Marketing, and Google Ads management.")
    },
    {
      title: t("Office Automation"),
      icon: Settings,
      desc: t("Professional training in Advanced Excel, Tally Prime, and Business Communication.")
    },
    {
      title: t("Hardware & AI"),
      icon: Cpu,
      desc: t("Practical exposure to computer hardware maintenance and basic AI model implementation.")
    },
    {
      title: t("Business Admin"),
      icon: Briefcase,
      desc: t("Learn about center management, student counseling, and academic operations.")
    }
  ];

  const benefits = [
    {
      title: t("Industry Mentors"),
      icon: Users,
      desc: t("Work directly under experts who have years of experience in the IT and Education sectors.")
    },
    {
      title: t("Live Projects"),
      icon: Globe,
      desc: t("Contribute to real projects used by SCREduc and its partners, building a solid portfolio.")
    },
    {
      title: t("Stipend-based"),
      icon: Award,
      desc: t("Earn while you learn. We offer performance-based stipends to our top-performing interns.")
    },
    {
      title: t("Placement Support"),
      icon: GraduationCap,
      desc: t("Successful interns get priority placement in SCREduc centers and partner companies.")
    }
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-grow">
        <Hero 
          title={t("Launch Your Professional Career with SCREduc")}
          subtitle={t("Join our hands-on internship program designed for Tier 2 and Tier 3 city students. Gain real-world experience, build your portfolio, and get certified by industry leaders.")}
          ctaText={t("Apply Now")}
          ctaLink="/student-inquiry?source=internship"
        />

        <Section 
          title={t("Why Choose SCREduc Internship?")}
          subtitle={t("Bridge the gap between academic learning and industry requirements with our structured 3-6 month programs.")}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, idx) => (
              <Card 
                key={idx}
                icon={benefit.icon}
                title={benefit.title}
                description={benefit.desc}
                className="hover:border-primary transition-all"
              />
            ))}
          </div>
        </Section>

        <Section title={t("Explore Our Internship Domains")} className="bg-slate-50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {domains.map((domain, idx) => (
              <div key={idx} className="p-8 bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                <div className="w-12 h-12 bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-white transition-colors">
                  <domain.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black uppercase mb-3 tracking-tight">{domain.title}</h3>
                <p className="text-slate-600 leading-relaxed text-sm mb-6">{domain.desc}</p>
                <Link to={`/student-inquiry?source=internship&domain=${encodeURIComponent(domain.title)}`} className="text-primary font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:gap-3 transition-all">
                  {t("Inquire More")} <CheckCircle2 className="w-3 h-3" />
                </Link>
              </div>
            ))}
          </div>
        </Section>

        <Section title={t("Our Selection Process")} className="bg-white">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
              <div className="relative">
                <div className="w-16 h-16 bg-slate-900 text-white rounded-full flex items-center justify-center text-xl font-black mx-auto mb-6 relative z-10">01</div>
                <div className="hidden md:block absolute top-8 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-0.5 bg-slate-100 z-0" />
                <h4 className="font-black uppercase text-sm mb-2">{t("Online Application")}</h4>
                <p className="text-slate-500 text-xs font-medium">{t("Fill the form with your interest area and skills.")}</p>
              </div>
              <div className="relative">
                <div className="w-16 h-16 bg-slate-900 text-white rounded-full flex items-center justify-center text-xl font-black mx-auto mb-6 relative z-10">02</div>
                <div className="hidden md:block absolute top-8 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-0.5 bg-slate-100 z-0" />
                <h4 className="font-black uppercase text-sm mb-2">{t("Technical Interview")}</h4>
                <p className="text-slate-500 text-xs font-medium">{t("A short discussion about your goals and technical knowledge.")}</p>
              </div>
              <div>
                <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center text-xl font-black mx-auto mb-6">03</div>
                <h4 className="font-black uppercase text-sm mb-2">{t("Onboarding")}</h4>
                <p className="text-slate-500 text-xs font-medium">{t("Join the team, get your mentor, and start working!")}</p>
              </div>
            </div>
          </div>
        </Section>

        <Section title={t("Internship Outcomes")} className="bg-slate-900 text-white" dark>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <h3 className="text-3xl font-black uppercase tracking-tighter leading-tight">{t("What You Take Home")}</h3>
              <p className="text-slate-400 text-lg">{t("Our program isn't just about a certificate; it's about making you \"Job-Ready\" for the competitive IT market.")}</p>
              <div className="space-y-4">
                {[
                  t("SCREduc Certified Professional Internship Certificate"),
                  t("Letter of Recommendation (LOR) for top performers"),
                  t("Portfolio of 2-3 Live Projects"),
                  t("Confidence to handle professional client requirements"),
                  t("Soft skills training and interview preparation")
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                    <span className="font-bold uppercase text-xs tracking-widest text-slate-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="aspect-video bg-white/5 border border-white/10 p-8 shadow-2xl backdrop-blur-sm">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center font-black text-white">S</div>
                  <div>
                    <p className="font-black uppercase text-sm">{t("Sunil Kumar")}</p>
                    <p className="text-primary text-[10px] font-black uppercase tracking-widest">{t("Web Dev Intern, 2025")}</p>
                  </div>
                </div>
                <p className="text-slate-400 italic leading-relaxed">"{t("The internship at SCREduc Rohtak was the turning point for me. I worked on the actual student portal and learned more in 3 months than in 3 years of college. Highly recommended for students in small towns!")}"</p>
              </div>
              <div className="absolute -bottom-6 -right-6 p-8 bg-primary text-white hidden md:block">
                <p className="text-4xl font-black leading-none">500+</p>
                <p className="text-xs font-bold uppercase tracking-widest mt-2">{t("Interns Trained")}</p>
              </div>
            </div>
          </div>
        </Section>

        <CTABanner />
      </main>

      <Footer />
    </div>
  );
};

export default StudentInternshipPage;
