import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Loader2, Plus, Minus, HelpCircle } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface FAQItem {
  _id: any;
  title: string;
  description: string;
  order: number;
}

const FAQPage = () => {
  const { t } = useTranslation();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const { data: faqs = [], isLoading } = useQuery<FAQItem[]>({
    queryKey: ["faqs"],
    queryFn: async () => {
      const res = await apiFetch("/api/cms?category=faq&active_only=true");
      return res.json();
    },
  });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 bg-primary text-primary-foreground">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight mb-4">
              {t("Frequently Asked Questions")}
            </h1>
            <p className="text-primary-foreground/70 max-w-2xl mx-auto font-medium">
              {t("Find answers to common questions about our courses, certifications, and franchise opportunities.")}
            </p>
          </div>
        </section>

        {/* FAQ Content */}
        <section className="py-20">
          <div className="container mx-auto px-4 max-w-3xl">
            {isLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
              </div>
            ) : faqs.length === 0 ? (
              <div className="text-center py-20 border border-dashed rounded-none">
                <HelpCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground uppercase text-xs font-black tracking-widest">
                  {t("No FAQs found at the moment.")}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {faqs.map((faq, idx) => (
                  <div 
                    key={faq._id?.$oid || faq._id || idx}
                    className="border border-border rounded-none overflow-hidden transition-all duration-300"
                  >
                    <button
                      onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                      className={cn(
                        "w-full flex items-center justify-between p-6 text-left transition-colors",
                        openIndex === idx ? "bg-primary/5" : "hover:bg-muted/50"
                      )}
                    >
                      <span className="font-bold text-lg pr-8">{faq.title}</span>
                      {openIndex === idx ? (
                        <Minus className="w-5 h-5 text-primary shrink-0" />
                      ) : (
                        <Plus className="w-5 h-5 text-muted-foreground shrink-0" />
                      )}
                    </button>
                    
                    <div 
                      className={cn(
                        "overflow-hidden transition-all duration-300 ease-in-out",
                        openIndex === idx ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                      )}
                    >
                      <div className="p-6 pt-0 text-muted-foreground leading-relaxed">
                        {faq.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Contact CTA */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-2xl font-black uppercase tracking-tight mb-4">{t("Still have questions?")}</h2>
            <p className="text-muted-foreground mb-8">{t("We're here to help you build your career.")}</p>
            <a 
              href="/contact" 
              className="inline-block bg-primary text-primary-foreground px-10 py-4 rounded-none font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all shadow-xl"
            >
              {t("Contact Support")}
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default FAQPage;
