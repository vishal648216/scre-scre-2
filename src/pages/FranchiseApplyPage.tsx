import React, { useState } from 'react';
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  Send,
  ShieldCheck,
  Users,
  MapPin,
  Briefcase,
  IndianRupee,
  CheckCircle2,
  Clock,
  ArrowRight,
  MessageSquare
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { usePublicSystemSettings } from "@/hooks/usePublicSystemSettings";

const FranchiseApplyPage = () => {
  const { t } = useTranslation();
  const { data: settings } = usePublicSystemSettings();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    city: "",
    state: "",
    budget: "",
    space: "",
    experience: "",
    message: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await apiFetch("/api/contact", {
        method: "POST",
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          city: formData.city,
          state: formData.state,
          subject: `Franchise Application: ${formData.city}`,
          message: `Budget: ${formData.budget}, Space: ${formData.space}, Experience: ${formData.experience}. Message: ${formData.message}`,
          enquiry_type: "franchise"
        })
      });

      if (res.ok) {
        toast.success(t("Application submitted! Our team will contact you within 24 hours."));
        setFormData({
          name: "", phone: "", email: "", city: "", state: "", budget: "", space: "", experience: "", message: ""
        });
      } else {
        toast.error(t("Failed to submit application. Please try again."));
      }
    } catch (err) {
      toast.error(t("An error occurred. Please try again later."));
    } finally {
      setLoading(false);
    }
  };

  const trustIndicators = [
    { icon: Users, label: t("Happy Centers"), val: "50+" },
    { icon: ShieldCheck, label: t("Years Excellence"), val: "10+" },
    { icon: MapPin, label: t("Strategic HQ"), val: (settings?.contact_address as string) || "# 785/10 Main Bazar Jeweler Market , opposite N.R, Jeweler, Jind, Haryana 126102 " }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <main className="flex-grow pt-32 pb-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-16 items-start">

            {/* Left Column: Content & Trust */}
            <div className="flex-1 space-y-12">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full">
                  <Clock className="w-3 h-3" /> {t("24-Hour Response Guarantee")}
                </div>
                <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-tight text-slate-900">
                  {t("Ready to Lead the")}<br />{t("Digital Revolution?")}
                </h1>
                <p className="text-lg text-slate-600 font-medium leading-relaxed">
                  {t("Join our network of 50+ successful centers. We are currently accepting applications for the 2026-27 academic session.")}
                  <span className="block mt-4 text-primary font-bold">{t("Limited slots available per district to ensure territory protection.")}</span>
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {trustIndicators.map((item, i) => (
                  <div key={i} className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shrink-0">
                      <item.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-2xl font-black text-slate-900">{item.val}</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{item.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-8 bg-slate-900 rounded-[32px] text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full -mr-16 -mt-16 blur-2xl" />
                <h4 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" /> {t("Why Apply Now?")}
                </h4>
                <ul className="space-y-3">
                  {[
                    t("Exclusive territory rights for early applicants"),
                    t("Special setup discount on premium center models"),
                    t("Immediate access to our 2026-27 Marketing Kit"),
                    t("Priority staff training and certification")
                  ].map((line, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-slate-300 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /> {line}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right Column: Application Form */}
            <div className="w-full lg:w-[500px] shrink-0">
              <div className="bg-white rounded-[40px] p-8 md:p-10 shadow-2xl shadow-slate-200/50 border border-slate-100">
                <h3 className="text-2xl font-bold mb-8 text-slate-900">{t("Application Form")}</h3>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{t("Full Name")}</label>
                    <input
                      required
                      type="text"
                      placeholder={t("John Doe")}
                      className="w-full h-14 px-6 bg-slate-50 border border-slate-200 rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all outline-none font-medium"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{t("Phone")}</label>
                      <input
                        required
                        type="tel"
                        placeholder={t("+91...")}
                        className="w-full h-14 px-6 bg-slate-50 border border-slate-200 rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all outline-none font-medium"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{t("City")}</label>
                      <input
                        required
                        type="text"
                        placeholder={t("e.g. Jind")}
                        className="w-full h-14 px-6 bg-slate-50 border border-slate-200 rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all outline-none font-medium"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{t("Budget (Approx)")}</label>
                      <select
                        required
                        className="w-full h-14 px-6 bg-slate-50 border border-slate-200 rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all outline-none font-medium appearance-none"
                        value={formData.budget}
                        onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                      >
                        <option value="">{t("Select Budget")}</option>
                        <option value="1.5-3L">₹1.5 - 3 Lakh</option>
                        <option value="3-7L">₹3 - 7 Lakh</option>
                        <option value="7L+">₹7 Lakh +</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{t("Space (Sq. Ft)")}</label>
                      <input
                        required
                        type="text"
                        placeholder={t("e.g. 800")}
                        className="w-full h-14 px-6 bg-slate-50 border border-slate-200 rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all outline-none font-medium"
                        value={formData.space}
                        onChange={(e) => setFormData({ ...formData, space: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{t("Education/Business Experience")}</label>
                    <textarea
                      placeholder={t("Briefly describe your background...")}
                      className="w-full h-32 px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all outline-none font-medium resize-none"
                      value={formData.experience}
                      onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                    />
                  </div>

                  <button
                    disabled={loading}
                    type="submit"
                    className="w-full h-16 bg-primary text-white font-bold rounded-2xl hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {loading ? t("Processing...") : t("Submit Application")} <ArrowRight className="w-5 h-5" />
                  </button>

                  <p className="text-[10px] text-center text-slate-400 font-medium uppercase tracking-widest mt-4">
                    {t("By submitting, you agree to our Franchise Privacy Policy.")}
                  </p>
                </form>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default FranchiseApplyPage;
