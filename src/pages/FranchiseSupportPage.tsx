import React, { useState } from 'react';
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { usePublicSystemSettings } from "@/hooks/usePublicSystemSettings";
import { 
  Phone, 
  Mail, 
  MessageSquare, 
  Clock, 
  ChevronDown, 
  Plus, 
  Minus, 
  Ticket, 
  ShieldCheck, 
  Zap,
  ArrowRight,
  CheckCircle2
} from "lucide-react";
import { Hero, Section } from "@/components/franchise/FranchiseComponents";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";

const FAQItem = ({ question, answer }: { question: string, answer: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-6 flex items-center justify-between text-left group"
      >
        <span className={cn("text-lg font-bold tracking-tight transition-colors", isOpen ? "text-primary" : "text-slate-900 group-hover:text-primary")}>
          {question}
        </span>
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-all", isOpen ? "bg-primary text-white rotate-180" : "bg-slate-50 text-slate-400")}>
          <ChevronDown className="w-4 h-4" />
        </div>
      </button>
      <div className={cn("overflow-hidden transition-all duration-300", isOpen ? "max-h-[500px] pb-6" : "max-h-0")}>
        <p className="text-slate-600 font-medium leading-relaxed">
          {answer}
        </p>
      </div>
    </div>
  );
};

const FranchiseSupportPage = () => {
  const { t } = useTranslation();
  const { data: settings } = usePublicSystemSettings();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    center_id: "",
    subject: "",
    priority: "low",
    message: ""
  });

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch("/api/contact", {
        method: "POST",
        body: JSON.stringify({
          name: formData.name,
          phone: formData.center_id, // Using center_id as phone/ref
          email: `${formData.center_id}@screduc.com`,
          subject: `Support Ticket [${formData.priority.toUpperCase()}]: ${formData.subject}`,
          message: formData.message,
          enquiry_type: "support_ticket"
        })
      });
      if (res.ok) {
        toast.success(t("Support ticket created! Our team will get back to you shortly."));
        setFormData({ name: "", center_id: "", subject: "", priority: "low", message: "" });
      }
    } catch (err) {
      toast.error(t("Failed to submit ticket."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      
      <main className="flex-grow">
        <Hero 
          title={t("World-Class Support for Every Partner")}
          subtitle={t("You're never alone in your journey. Our dedicated support ecosystem ensures your center runs smoothly, 24/7.")}
          badge={t("Partner Success Center")}
          ctaText={t("Submit Support Ticket")}
          ctaLink="#ticket-form"
        />

        {/* Support Channels */}
        <Section 
          title={t("Direct Support Channels")}
          subtitle={t("Choose the method that works best for you. Our experts are standing by to help.")}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-10 bg-slate-50 rounded-[32px] border border-slate-100 group hover:border-primary/20 transition-all">
              <div className="w-14 h-14 bg-green-500/10 text-green-600 rounded-2xl flex items-center justify-center mb-8">
                <MessageSquare className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold mb-3">{t("WhatsApp Support")}</h3>
              <p className="text-slate-600 font-medium mb-6 text-sm">{t("Instant messaging for quick operational queries and technical help.")}</p>
              <a href={`https://wa.me/${((settings?.contact_phone as string) || "919466317100").replace(/\D/g, "")}`} className="text-primary font-bold text-sm flex items-center gap-2 hover:gap-3 transition-all">
                {t("Chat on WhatsApp")} <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            <div className="p-10 bg-slate-50 rounded-[32px] border border-slate-100 group hover:border-primary/20 transition-all">
              <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-8">
                <Phone className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold mb-3">{t("Priority Hotline")}</h3>
              <p className="text-slate-600 font-medium mb-6 text-sm">{t("Direct voice support for urgent matters available Mon-Sat, 10am-6pm.")}</p>
              <a href={`tel:${(settings?.contact_phone as string) || "+919466317100"}`} className="text-primary font-bold text-sm flex items-center gap-2 hover:gap-3 transition-all">
                {t("Call")} {(settings?.contact_phone as string) || "+91 94663 17100"} <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            <div className="p-10 bg-slate-50 rounded-[32px] border border-slate-100 group hover:border-primary/20 transition-all">
              <div className="w-14 h-14 bg-slate-900/10 text-slate-900 rounded-2xl flex items-center justify-center mb-8">
                <Mail className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold mb-3">{t("Email Desk")}</h3>
              <p className="text-slate-600 font-medium mb-6 text-sm">{t("For formal requests, documentation, and non-urgent detailed queries.")}</p>
              <a href={`mailto:${(settings?.contact_email as string) || "support@screduc.com"}`} className="text-primary font-bold text-sm flex items-center gap-2 hover:gap-3 transition-all">
                {(settings?.contact_email as string) || "support@screduc.com"} <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </Section>

        {/* Ticket Submission */}
        <section id="ticket-form" className="py-24 bg-slate-950 text-white">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-20">
              <div className="flex-1 space-y-8">
                <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/20">
                  <Ticket className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-tight">
                  {t("Raised a")}<br/>{t("Support Ticket") }
                </h2>
                <p className="text-lg text-slate-400 font-medium leading-relaxed max-w-md">
                  {t("Have a complex issue? Our ticketing system ensures your query is tracked and resolved within 24-48 business hours.")}
                </p>
                <div className="space-y-4 pt-8 border-t border-white/10">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span className="font-bold text-sm uppercase tracking-widest text-slate-300">{t("Automated Tracking")}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span className="font-bold text-sm uppercase tracking-widest text-slate-300">{t("Expert Resolution")}</span>
                  </div>
                </div>
              </div>

              <div className="w-full lg:w-[600px] bg-white rounded-[40px] p-8 md:p-12 text-slate-900 shadow-2xl">
                <form onSubmit={handleSubmitTicket} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{t("Center Name")}</label>
                      <input 
                        required
                        type="text" 
                        placeholder={t("Your Center Name")}
                        className="w-full h-14 px-6 bg-slate-50 border border-slate-200 rounded-2xl focus:border-primary outline-none font-medium"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{t("Center ID")}</label>
                      <input 
                        required
                        type="text" 
                        placeholder="SCRE-XXXX"
                        className="w-full h-14 px-6 bg-slate-50 border border-slate-200 rounded-2xl focus:border-primary outline-none font-medium"
                        value={formData.center_id}
                        onChange={(e) => setFormData({...formData, center_id: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{t("Subject")}</label>
                      <input 
                        required
                        type="text" 
                        placeholder={t("e.g. ERP Access Issue")}
                        className="w-full h-14 px-6 bg-slate-50 border border-slate-200 rounded-2xl focus:border-primary outline-none font-medium"
                        value={formData.subject}
                        onChange={(e) => setFormData({...formData, subject: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{t("Priority")}</label>
                      <select 
                        required
                        className="w-full h-14 px-6 bg-slate-50 border border-slate-200 rounded-2xl focus:border-primary outline-none font-medium appearance-none"
                        value={formData.priority}
                        onChange={(e) => setFormData({...formData, priority: e.target.value})}
                      >
                        <option value="low">{t("Low - General Inquiry")}</option>
                        <option value="medium">{t("Medium - Technical Issue")}</option>
                        <option value="high">{t("High - Operational Blocker")}</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{t("Issue Description")}</label>
                    <textarea 
                      required
                      placeholder={t("Please provide details about your issue...")}
                      className="w-full h-40 px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-primary outline-none font-medium resize-none"
                      value={formData.message}
                      onChange={(e) => setFormData({...formData, message: e.target.value})}
                    />
                  </div>

                  <button 
                    disabled={loading}
                    type="submit" 
                    className="w-full h-16 bg-primary text-white font-bold rounded-2xl hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {loading ? t("Submitting...") : t("Submit Ticket")} <Zap className="w-5 h-5" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <Section 
          title={t("Frequently Asked Questions")}
          subtitle={t("Quick answers to common questions about franchise operations and support.")}
          className="bg-white"
        >
          <div className="max-w-3xl mx-auto bg-white border border-slate-100 rounded-[40px] p-8 md:p-12 shadow-xl shadow-slate-100/50">
            <FAQItem 
              question={t("What kind of marketing support do you provide?")}
              answer={t("We provide a complete launch kit including digital graphics, banners, brochures, and flyers. We also run centralized social media campaigns and help you with local SEO to ensure students find your center.")}
            />
            <FAQItem 
              question={t("How do I get technical training for the ERP?")}
              answer={t("Upon joining, we conduct a 2-day virtual onboarding session. Additionally, we have detailed video tutorials available in your partner portal, and our support team can do a 1-on-1 screen-share if needed.")}
            />
            <FAQItem 
              question={t("Is there a limit to how many support tickets I can raise?")}
              answer={t("No, there is no limit. We are here to ensure your success. However, we encourage checking our knowledge base first for common technical issues.")}
            />
            <FAQItem 
              question={t("How often are course materials updated?")}
              answer={t("Our curriculum team updates the content every 6 months to ensure we are aligned with current industry trends and software versions.")}
            />
          </div>
        </Section>
      </main>

      <Footer />
    </div>
  );
};

export default FranchiseSupportPage;
