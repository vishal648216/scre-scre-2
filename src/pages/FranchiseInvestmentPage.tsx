import React from 'react';
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { 
  IndianRupee, 
  TrendingUp, 
  BarChart3, 
  PieChart, 
  Clock, 
  ShieldCheck,
  CheckCircle2,
  ArrowUpRight
} from "lucide-react";
import { Hero, Section, Card, CTABanner } from "@/components/franchise/FranchiseComponents";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const FranchiseInvestmentPage = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-grow">
        <Hero 
          title={t("Premium Education. Scalable Returns.")}
          subtitle={t("Invest in a future-proof business model. SCREduc provides a high-growth platform with low overheads and maximum social impact.")}
        />

        <Section 
          title={t("Investment Models")}
          subtitle={t("Strategic packages designed for different city tiers and business scales. Choose your path to leadership.")}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {/* Basic Center */}
            <div className="p-12 border border-border bg-card flex flex-col group hover:border-primary transition-all duration-500 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 -mr-12 -mt-12 rounded-full group-hover:scale-150 transition-transform duration-700" />
              <div className="w-14 h-14 bg-primary/10 text-primary flex items-center justify-center mb-8 rounded-none group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-black uppercase mb-2 tracking-tight">{t("Village Hub")}</h3>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-8">{t("Tier 3 / Rural Focus")}</p>
              <p className="text-4xl font-black mb-8 text-foreground tracking-tighter">₹1.5 - 3L</p>
              <ul className="space-y-4 mb-12 flex-grow">
                {[t("5-8 Computers"), t("400-600 Sq. Ft."), t("Basic IT Suite"), t("Regional Support")].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
                    <CheckCircle2 className="w-3 h-3 text-primary" /> {item}
                  </li>
                ))}
              </ul>
              <button className="w-full py-4 border border-primary text-primary font-black uppercase text-[10px] tracking-[0.2em] hover:bg-primary hover:text-primary-foreground transition-all">{t("Select Model")}</button>
            </div>

            {/* Professional Center */}
            <div className="p-12 border-4 border-primary bg-foreground text-background flex flex-col relative shadow-2xl scale-105 z-10 group">
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-6 py-2 text-[10px] font-black uppercase tracking-[0.2em]">{t("Recommended")}</div>
              <div className="w-14 h-14 bg-primary text-primary-foreground flex items-center justify-center mb-8 rounded-none">
                <TrendingUp className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-black uppercase mb-2 tracking-tight">{t("Town Center")}</h3>
              <p className="text-[10px] font-black text-background/50 uppercase tracking-[0.2em] mb-8">{t("Tier 2 / Urban Focus")}</p>
              <p className="text-4xl font-black mb-8 text-background tracking-tighter">₹3 - 7L</p>
              <ul className="space-y-4 mb-12 flex-grow">
                {[t("10-15 Computers"), t("800-1200 Sq. Ft."), t("Full Course Catalog"), t("Placement Hub")].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-background/70">
                    <CheckCircle2 className="w-3 h-3 text-primary" /> {item}
                  </li>
                ))}
              </ul>
              <button className="w-full py-4 bg-primary text-primary-foreground font-black uppercase text-[10px] tracking-[0.2em] hover:opacity-90 transition-all">{t("Start Application")}</button>
            </div>

            {/* Regional Hub */}
            <div className="p-12 border border-border bg-card flex flex-col group hover:border-primary transition-all duration-500 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 -mr-12 -mt-12 rounded-full group-hover:scale-150 transition-transform duration-700" />
              <div className="w-14 h-14 bg-primary/10 text-primary flex items-center justify-center mb-8 rounded-none group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                <BarChart3 className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-black uppercase mb-2 tracking-tight">{t("Regional Hub")}</h3>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-8">{t("District / Metro Focus")}</p>
              <p className="text-4xl font-black mb-8 text-foreground tracking-tighter">₹7 - 15L</p>
              <ul className="space-y-4 mb-12 flex-grow">
                {[t("20+ Computers"), t("1500+ Sq. Ft."), t("Advanced Tech Lab"), t("Strategic HQ")].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
                    <CheckCircle2 className="w-3 h-3 text-primary" /> {item}
                  </li>
                ))}
              </ul>
              <button className="w-full py-4 border border-primary text-primary font-black uppercase text-[10px] tracking-[0.2em] hover:bg-primary hover:text-primary-foreground transition-all">{t("Explore Scope")}</button>
            </div>
          </div>
        </Section>

        <Section title={t("Profitability Index")} className="bg-foreground text-background" dark>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
            <div className="space-y-12">
              <div className="space-y-6">
                <h3 className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-none">{t("Sustainable Revenue Architecture")}</h3>
                <p className="text-background/60 text-lg font-medium uppercase tracking-widest leading-relaxed">{t("Our model prioritizes early cash flow and long-term center stability through diverse revenue streams.")}</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="p-10 bg-background/5 border border-white/10 group hover:border-primary transition-colors">
                  <Clock className="w-10 h-10 text-primary mb-6" />
                  <h4 className="text-xl font-black uppercase mb-4 tracking-tight">{t("Rapid ROI")}</h4>
                  <p className="text-[10px] font-bold text-background/50 uppercase tracking-widest leading-relaxed">{t("Targeted break-even within 8 to 14 months based on operational efficiency.")}</p>
                </div>
                <div className="p-10 bg-background/5 border border-white/10 group hover:border-primary transition-colors">
                  <PieChart className="w-10 h-10 text-primary mb-6" />
                  <h4 className="text-xl font-black uppercase mb-4 tracking-tight">{t("Fee Streams")}</h4>
                  <p className="text-[10px] font-bold text-background/50 uppercase tracking-widest leading-relaxed">{t("Continuous income from monthly tuition, examinations, and certifications.")}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-background p-12 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16" />
              <h3 className="text-2xl font-black text-foreground uppercase mb-10 tracking-tight flex items-center gap-3">
                <ArrowUpRight className="w-6 h-6 text-primary" /> {t("Monthly Projection")}
              </h3>
              <div className="space-y-6">
                {[
                  { label: t("Student Base"), val: "100", color: "text-foreground" },
                  { label: t("Avg. Tuition"), val: "₹1,200", color: "text-foreground" },
                  { label: t("Gross Revenue"), val: "₹1,20,000", color: "text-primary" },
                  { label: t("OPEX (Est.)"), val: "₹45,000", color: "text-rose-600" }
                ].map((row, i) => (
                  <div key={i} className="flex justify-between items-center pb-4 border-b border-border">
                    <span className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.2em]">{row.label}</span>
                    <span className={cn("text-xl font-black tracking-tighter", row.color)}>{row.val}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-6">
                  <span className="text-foreground font-black uppercase text-xs tracking-[0.3em]">{t("Net Profit")}</span>
                  <div className="text-right">
                    <span className="text-4xl font-black text-primary tracking-tighter">₹75,000</span>
                    <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mt-1">{t("Estimated / Month")}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section title={t("Asset Allocation")}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card 
              icon={IndianRupee}
              title={t("Franchise Fee")}
              description={t("Brand licensing, initial training, and lifetime access to our unified portal.")}
            />
            <Card 
              icon={ShieldCheck}
              title={t("Infrastructure")}
              description={t("Center design, premium furniture setup, and modern computer hardware.")}
            />
            <Card 
              icon={TrendingUp}
              title={t("Market Launch")}
              description={t("Aggressive local promotion, high-impact banners, and digital lead generation.")}
            />
            <Card 
              icon={BarChart3}
              title={t("Reserve Capital")}
              description={t("Strategic working capital for rent, salaries, and utility management.")}
            />
          </div>
        </Section>

        <CTABanner />
      </main>

      <Footer />
    </div>
  );
};

export default FranchiseInvestmentPage;
