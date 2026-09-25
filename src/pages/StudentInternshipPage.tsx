import React, { useState, useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { 
  Briefcase, GraduationCap, Code, Layout, BarChart, Settings, 
  Award, Globe, Users, CheckCircle2, Cpu, Send, Loader2, Sparkles, Building2,
  BookOpen, Calendar, MapPin, FileText, Check, ShieldCheck, Phone, Mail, User
} from "lucide-react";
import { Hero, Section, Card, CTABanner } from "@/components/franchise/FranchiseComponents";
import { apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

export default function StudentInternshipPage() {
  const { t } = useTranslation();

  const [centers, setCenters] = useState<{ id?: string; _id?: string; name: string; code: string; city?: string }[]>([]);
  const [colleges, setColleges] = useState<{ id?: string; _id?: string; name: string }[]>([]);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState("Web Development");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    gender: "Male",
    dob: "",
    college: "",
    qualification: "B.Tech",
    branch: "Computer Science",
    passingYear: "2026",
    internshipDomain: "Web Development",
    internshipMode: "Online",
    duration: "3 Months",
    centerId: "",
    resumeUrl: "",
    message: ""
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [centerRes, collegeRes] = await Promise.all([
        apiFetch("/api/public/centers"),
        apiFetch("/api/public/colleges")
      ]);

      if (centerRes.ok) {
        const cData = await centerRes.json();
        setCenters(Array.isArray(cData?.data) ? cData.data : Array.isArray(cData) ? cData : []);
      }
      if (collegeRes.ok) {
        const colData = await collegeRes.json();
        setColleges(Array.isArray(colData) ? colData : []);
      }
    } catch (err) {
      console.error("Failed to load center/college list:", err);
    }
  };

  const handleOpenModal = (domainName: string) => {
    setSelectedDomain(domainName);
    setFormData(prev => ({ ...prev, internshipDomain: domainName }));
    setIsApplyModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.college) {
      toast.error("Please fill in your name, phone number and college.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          gender: formData.gender,
          dob: formData.dob,
          college: formData.college,
          qualification: formData.qualification,
          branch: formData.branch,
          passing_year: formData.passingYear,
          internship_domain: formData.internshipDomain,
          internship_mode: formData.internshipMode,
          duration: formData.duration,
          center_id: formData.centerId || undefined,
          resume_url: formData.resumeUrl,
          message: formData.message,
          course: `Internship - ${formData.internshipDomain}`,
          enquiry_type: "internship",
          subject: `Internship Application: ${formData.internshipDomain} (${formData.internshipMode})`
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsSuccess(true);
        toast.success("Internship application submitted successfully!");
      } else {
        toast.error(data.message || "Failed to submit application.");
      }
    } catch (err) {
      toast.error("Error connecting to server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const domains = [
    { title: "Web Development", icon: Code, desc: "Learn MERN Stack, React, Node.js, and MongoDB while building live production portals." },
    { title: "AI & Machine Learning", icon: Cpu, desc: "Hands-on model training, Python pipelines, and AI Tutor integration." },
    { title: "Digital Marketing & SEO", icon: BarChart, desc: "Master Google Ads, Meta Ads, SEO optimization, and lead generation automation." },
    { title: "Graphic & UI/UX Design", icon: Layout, desc: "Design interfaces, CorelDraw graphics, Photoshop banners, and brand identity." },
    { title: "Hardware & Networking", icon: Settings, desc: "Practical computer maintenance, server setups, router configuration & IoT." },
    { title: "Accounting & Tally Prime", icon: Briefcase, desc: "GST return filing, advanced Tally Prime, e-invoicing & corporate finance balance sheets." }
  ];

  const placementPartners = [
    { name: "SCRE Education Rohtak Hub", city: "Rohtak, Haryana", type: "Regional Center" },
    { name: "Apex Tech Solutions", city: "New Delhi", type: "IT Partner Company" },
    { name: "Jaipur Digital Campus", city: "Jaipur, Rajasthan", type: "Franchise Partner" },
    { name: "Chandigarh Innovation Lab", city: "Chandigarh", type: "Research Center" },
    { name: "Patna Skill Academy", city: "Patna, Bihar", type: "Training Partner" }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">
      <Header />

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative py-24 bg-gradient-to-b from-slate-900 via-slate-950 to-black overflow-hidden border-b border-slate-800">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/20 rounded-full blur-[140px] pointer-events-none" />
          
          <div className="container mx-auto px-4 relative z-10 text-center max-w-4xl">
            <span className="px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-primary/20 text-primary border border-primary/30 inline-flex items-center gap-2 mb-6">
              <Sparkles className="w-3.5 h-3.5" /> Official SCRE Placement & Internship Drive
            </span>
            <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tight text-white leading-tight mb-6">
              Launch Your Career with <span className="text-primary bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">Real Industrial Internships</span>
            </h1>
            <p className="text-slate-300 text-lg md:text-xl font-medium leading-relaxed mb-8 max-w-2xl mx-auto">
              Get 3-6 months hands-on experience, work on live projects, get performance stipends, and earn official industry certificates backed by top IT partners.
            </p>
            
            <div className="flex flex-wrap justify-center gap-4">
              <button
                onClick={() => handleOpenModal("Web Development")}
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-primary via-primary/90 to-blue-600 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-primary/20 hover:scale-105 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" /> Apply for Internship
              </button>
              <a
                href="#domains"
                className="px-8 py-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white font-bold text-sm uppercase tracking-wider transition-colors"
              >
                Browse Domains
              </a>
            </div>
          </div>
        </section>

        {/* Explore Domains Grid */}
        <section id="domains" className="py-20 container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <h2 className="text-3xl font-black uppercase tracking-tight text-white">Explore Available Internship Domains</h2>
            <p className="text-slate-400 text-sm">Select your field of interest and submit your application directly to our recruitment panel.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {domains.map((dom, idx) => (
              <div key={idx} className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-8 hover:border-primary/50 transition-all flex flex-col justify-between group shadow-xl">
                <div>
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-white transition-all">
                    <dom.icon className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-black uppercase text-white mb-3">{dom.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed mb-6">{dom.desc}</p>
                </div>
                <button
                  onClick={() => handleOpenModal(dom.title)}
                  className="w-full py-3 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-white font-bold text-xs uppercase tracking-widest border border-primary/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  Apply in {dom.title} <CheckCircle2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Placement Centers & Companies Listing */}
        <section className="py-20 bg-slate-900/50 border-y border-slate-800">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
              <h2 className="text-3xl font-black uppercase tracking-tight text-white">Our Internship Placement Network</h2>
              <p className="text-slate-400 text-sm">Internships are offered across top centers, IT firms, and research laboratories.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {placementPartners.map((partner, idx) => (
                <div key={idx} className="bg-slate-950 border border-slate-800 p-5 rounded-xl text-center space-y-2 hover:border-blue-500/40 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 mx-auto flex items-center justify-center">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-sm text-white">{partner.name}</h4>
                  <p className="text-[11px] text-slate-400">{partner.city}</p>
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                    {partner.type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Comprehensive Application Form Card */}
        <section className="py-20 container mx-auto px-4 max-w-4xl">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
            <div className="border-b border-slate-800 pb-6 text-center space-y-2">
              <h2 className="text-2xl font-black uppercase tracking-tight text-white">Online Student Internship Registration Form</h2>
              <p className="text-slate-400 text-xs">Fill in your academic and contact details to get selected for upcoming batches.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Personal Details */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                  <User className="w-4 h-4" /> Personal Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Verma"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Phone Number (10 Digits) *</label>
                    <input
                      type="tel"
                      required
                      placeholder="9876543210"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Email Address</label>
                    <input
                      type="email"
                      placeholder="student@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Gender</label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Date of Birth</label>
                    <input
                      type="date"
                      value={formData.dob}
                      onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Academic Details */}
              <div className="space-y-4 border-t border-slate-800 pt-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-blue-400 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4" /> Academic Qualification
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">College / University Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Enter your college name"
                      value={formData.college}
                      onChange={(e) => setFormData({ ...formData, college: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Highest Qualification / Degree</label>
                    <select
                      value={formData.qualification}
                      onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                    >
                      <option value="B.Tech">B.Tech / B.E</option>
                      <option value="BCA">BCA</option>
                      <option value="MCA">MCA</option>
                      <option value="Diploma">Diploma CS/IT/EC</option>
                      <option value="B.Sc CS">B.Sc Computer Science</option>
                      <option value="B.Com">B.Com / Accounts</option>
                      <option value="Other">Other Degree</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Branch / Specialization</label>
                    <input
                      type="text"
                      placeholder="e.g. Computer Science, AI, IT"
                      value={formData.branch}
                      onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Passing Year</label>
                    <input
                      type="text"
                      placeholder="e.g. 2026"
                      value={formData.passingYear}
                      onChange={(e) => setFormData({ ...formData, passingYear: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Internship Preferences */}
              <div className="space-y-4 border-t border-slate-800 pt-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400 flex items-center gap-2">
                  <Briefcase className="w-4 h-4" /> Internship Preferences
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Internship Domain</label>
                    <select
                      value={formData.internshipDomain}
                      onChange={(e) => setFormData({ ...formData, internshipDomain: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                    >
                      {domains.map((d, i) => (
                        <option key={i} value={d.title}>{d.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Internship Mode</label>
                    <select
                      value={formData.internshipMode}
                      onChange={(e) => setFormData({ ...formData, internshipMode: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                    >
                      <option value="Online">Online / Remote</option>
                      <option value="Offline Center">Offline Center</option>
                      <option value="Company Placement">Company Placement</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Duration</label>
                    <select
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                    >
                      <option value="1 Month">1 Month</option>
                      <option value="2 Months">2 Months</option>
                      <option value="3 Months">3 Months</option>
                      <option value="6 Months">6 Months</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Resume / LinkedIn / GitHub URL</label>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/your-resume-pdf"
                    value={formData.resumeUrl}
                    onChange={(e) => setFormData({ ...formData, resumeUrl: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-primary via-primary/90 to-blue-600 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Submitting Application...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Submit Internship Application
                  </>
                )}
              </button>
            </form>
          </div>
        </section>
      </main>

      {/* Direct Domain Apply Modal */}
      {isApplyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 relative text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-black uppercase text-white">Apply for {selectedDomain} Internship</h3>
              <button onClick={() => setIsApplyModalOpen(false)} className="text-slate-400 hover:text-white font-bold text-lg">✕</button>
            </div>

            {isSuccess ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8" />
                </div>
                <h4 className="text-xl font-bold">Application Received!</h4>
                <p className="text-slate-400 text-xs">Our academic coordinator will reach out to you within 24 hours.</p>
                <button
                  onClick={() => { setIsApplyModalOpen(false); setIsSuccess(false); }}
                  className="py-2.5 px-6 rounded-xl bg-primary text-white font-bold text-xs"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">College Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.college}
                      onChange={(e) => setFormData({ ...formData, college: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Mode</label>
                    <select
                      value={formData.internshipMode}
                      onChange={(e) => setFormData({ ...formData, internshipMode: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                    >
                      <option value="Online">Online / Remote</option>
                      <option value="Offline Center">Offline Center</option>
                      <option value="Company Placement">Company Placement</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Duration</label>
                    <select
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                    >
                      <option value="1 Month">1 Month</option>
                      <option value="2 Months">2 Months</option>
                      <option value="3 Months">3 Months</option>
                      <option value="6 Months">6 Months</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsApplyModalOpen(false)}
                    className="py-2 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="py-2 px-5 rounded-xl bg-primary text-white font-bold text-xs flex items-center gap-2"
                  >
                    {isSubmitting ? "Submitting..." : "Submit Application"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
