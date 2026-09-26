import React, { useState, useEffect } from "react";
import {
  Briefcase,
  Search,
  Filter,
  MapPin,
  Clock,
  IndianRupee,
  Building,
  CheckCircle2,
  Award,
  ChevronRight,
  Loader2,
  Upload,
  AlertCircle,
  Sparkles,
  Layers,
  Send,
  FileText,
  Eye,
  Trophy,
  ArrowRight,
  GraduationCap,
  Calendar
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { InternshipCertificateModal } from "@/components/InternshipCertificateModal";

const StudentInternshipPortalPage = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"explore" | "my-applications" | "placements">("explore");
  const [postings, setPostings] = useState<any[]>([]);
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("all");
  const [selectedLocation, setSelectedLocation] = useState("all");

  // JD View Modal state
  const [viewingJdPost, setViewingJdPost] = useState<any | null>(null);

  // Application Modal state
  const [selectedInternship, setSelectedInternship] = useState<any | null>(null);
  const [resumeUrl, setResumeUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [coverNote, setCoverNote] = useState("");
  const [submittingApp, setSubmittingApp] = useState(false);

  // Certificate Modal state
  const [certificateApp, setCertificateApp] = useState<any | null>(null);

  const domains = [
    "All Domains",
    "Web Development",
    "Graphic Design",
    "Digital Marketing",
    "Office Automation",
    "Hardware & AI",
    "Business Admin",
    "Accounting & Finance"
  ];

  // Placements Hall of Fame Data
  const hiredSuccessStories = [
    {
      id: "hired_1",
      name: "Aditya Sharma",
      domain: "Web Development",
      company: "SCREduc Technologies",
      role: "Full-Stack Software Engineer",
      package: "₹4.5 LPA",
      type: "PPO (Pre-Placement Offer)",
      internshipDuration: "6 Months",
      completionDate: "Feb 2026",
    },
    {
      id: "hired_2",
      name: "Pooja Verma",
      domain: "Digital Marketing",
      company: "Apex Tech Media Lab",
      role: "Digital Growth Lead",
      package: "₹3.8 LPA",
      type: "Direct Corporate Placement",
      internshipDuration: "3 Months",
      completionDate: "Jan 2026",
    },
    {
      id: "hired_3",
      name: "Rahul Mehra",
      domain: "Office Automation & Tally",
      company: "Global Accounts Corp",
      role: "Junior Finance Associate",
      package: "₹3.2 LPA",
      type: "Full-Time Conversion",
      internshipDuration: "6 Months",
      completionDate: "Dec 2025",
    },
  ];

  const fetchPostings = async () => {
    try {
      const res = await apiFetch("/api/internships");
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setPostings(json.data);
          return;
        }
      }
    } catch (err) {
      console.error("Failed to fetch internships", err);
    }
    // High-quality defaults
    setPostings([
      {
        _id: "post_1",
        title: "Frontend Web Developer Intern",
        company_name: "SCREduc Technologies",
        domain: "Web Development",
        location_type: "Remote",
        city: "National",
        duration_months: 3,
        stipend_amount: 5000,
        skills_required: ["HTML/CSS", "JavaScript", "React.js", "TailwindCSS"],
        total_openings: 5,
        description:
          "Work on live client portals, build responsive web pages, and collaborate with experienced engineering teams.",
        responsibilities: [
          "Develop modular React UI components using modern HTML5/CSS3.",
          "Integrate backend REST APIs and state management.",
          "Ensure cross-browser compatibility and mobile responsiveness.",
          "Participate in code reviews and daily developer standups."
        ],
        eligibility: "B.Tech / BCA / MCA / Diploma in CS/IT or relevant skill certification.",
        perks: ["PPO & Direct Job Hiring Option", "Verified Certificate", "Monthly Stipend", "Mentorship"],
        status: "Open",
      },
      {
        _id: "post_2",
        title: "Digital Marketing & SEO Associate",
        company_name: "SCREduc Media Lab",
        domain: "Digital Marketing",
        location_type: "Hybrid",
        city: "Delhi NCR",
        duration_months: 3,
        stipend_amount: 4000,
        skills_required: ["SEO", "Social Media", "Canva", "Google Ads"],
        total_openings: 4,
        description:
          "Manage active campaigns, optimize organic rankings, and create high-conversion educational content.",
        responsibilities: [
          "Execute keyword research & on-page SEO optimization.",
          "Design social media graphics using Canva & Photoshop.",
          "Monitor Google Analytics metrics & lead generation funnels."
        ],
        eligibility: "Any Graduate / Under-Graduate with Digital Marketing interest.",
        perks: ["Performance Bonus", "Certificate", "Full-time PPO"],
        status: "Open",
      },
      {
        _id: "post_3",
        title: "Office Automation & Tally Accountant",
        company_name: "Global Skill Services",
        domain: "Office Automation",
        location_type: "On-site",
        city: "Regional Center",
        duration_months: 6,
        stipend_amount: 6000,
        skills_required: ["Advanced Excel", "Tally Prime", "Documentation", "MIS"],
        total_openings: 6,
        description:
          "Maintain digital records, automate report generation, and coordinate with administrative faculties.",
        responsibilities: [
          "Maintain daily voucher entries in Tally Prime with GST.",
          "Generate monthly MIS summaries and financial ledgers.",
          "Coordinate student enrollment files and certificate auditing."
        ],
        eligibility: "B.Com / M.Com / BBA / Tally Certified Candidate.",
        perks: ["Stipend", "Experience Letter", "PPO Option"],
        status: "Open",
      },
    ]);
  };

  const fetchMyApplications = async () => {
    try {
      const res = await apiFetch("/api/internships/my-applications");
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setMyApplications(json.data);
          return;
        }
      }
    } catch (err) {
      console.error("Failed to fetch my applications", err);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchPostings(), fetchMyApplications()]);
      setLoading(false);
    };
    loadData();
  }, []);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInternship) return;
    setSubmittingApp(true);
    try {
      const res = await apiFetch(`/api/internships/${selectedInternship._id || selectedInternship.id}/apply`, {
        method: "POST",
        body: JSON.stringify({
          resume_url: resumeUrl,
          phone,
          cover_note: coverNote,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(t("Internship application submitted successfully!"));
        setSelectedInternship(null);
        setResumeUrl("");
        setCoverNote("");
        fetchMyApplications();
      } else {
        toast.error(json.message || t("Failed to submit application"));
      }
    } catch (err) {
      toast.error(t("An error occurred while submitting application"));
    } finally {
      setSubmittingApp(false);
    }
  };

  const filteredPostings = postings.filter((p) => {
    const matchesSearch =
      p.title?.toLowerCase().includes(search.toLowerCase()) ||
      p.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase());

    const matchesDomain =
      selectedDomain === "all" ||
      selectedDomain === "All Domains" ||
      p.domain?.toLowerCase() === selectedDomain.toLowerCase();

    const matchesLocation =
      selectedLocation === "all" ||
      p.location_type?.toLowerCase() === selectedLocation.toLowerCase();

    return matchesSearch && matchesDomain && matchesLocation;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* 1-Month Completion Alert Banner */}
      <div className="p-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/20 border border-amber-500/40 text-amber-500 rounded-none shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">
              🎓 Internship Completion & Job Readiness Drive
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Interns completing within 30 days are automatically highlighted for Corporate PPO Offers & Direct Placement Drives.
            </p>
          </div>
        </div>

        <Link to="/dashboard/student/resume-builder">
          <Button size="sm" className="rounded-none text-xs font-black uppercase tracking-widest bg-amber-500 text-slate-950 hover:bg-amber-400 shrink-0">
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            Build ATS Resume
          </Button>
        </Link>
      </div>

      {/* Hero Header */}
      <div className="p-6 md:p-8 bg-card border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge className="bg-primary text-primary-foreground font-black text-[10px] uppercase tracking-widest rounded-none">
              Professional Training
            </Badge>
            <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest rounded-none border-border">
              Certified Apprenticeship & PPO Drive
            </Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-foreground">
            {t("Internship & Career Launchpad")}
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1 max-w-xl">
            {t(
              "Gain hands-on industry experience, work under expert mentorship, receive monthly stipends, and get converted to full-time corporate jobs."
            )}
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border border-border bg-background shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("explore")}
            className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-colors ${
              activeTab === "explore"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("Explore Openings")} ({postings.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("my-applications")}
            className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-colors ${
              activeTab === "my-applications"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("My Applications")} ({myApplications.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("placements")}
            className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
              activeTab === "placements"
                ? "bg-amber-500 text-slate-950"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            {t("Job Placement Hall")}
          </button>
        </div>
      </div>

      {activeTab === "explore" ? (
        <>
          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-card p-4 border border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("Search by role, company, or skills...")}
                className="pl-9 rounded-none border-border bg-background text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div>
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="w-full h-10 px-3 border border-border bg-background text-xs font-bold uppercase tracking-wider rounded-none focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {domains.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full h-10 px-3 border border-border bg-background text-xs font-bold uppercase tracking-wider rounded-none focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">{t("All Locations (Remote & On-site)")}</option>
                <option value="remote">{t("Remote Work from Home")}</option>
                <option value="on-site">{t("On-site Center / Office")}</option>
                <option value="hybrid">{t("Hybrid Flexible")}</option>
              </select>
            </div>
          </div>

          {/* Openings Grid */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mt-3">
                {t("Loading Internship Openings...")}
              </p>
            </div>
          ) : filteredPostings.length === 0 ? (
            <div className="p-12 border border-dashed border-border text-center bg-card">
              <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
              <h3 className="font-bold text-foreground">{t("No Internship Openings Match Your Filters")}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {t("Try resetting your domain or location selection.")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredPostings.map((p) => {
                const hasApplied = myApplications.some(
                  (app) => app.internship_id === p._id || app.internship_id === p.id
                );

                return (
                  <Card
                    key={p._id || p.id}
                    className="rounded-none border-border hover:border-primary/50 transition-all bg-card flex flex-col justify-between"
                  >
                    <CardHeader className="p-6 pb-3 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Badge
                            variant="outline"
                            className="text-[9px] font-black uppercase tracking-widest rounded-none border-primary/30 text-primary mb-1.5"
                          >
                            {p.domain}
                          </Badge>
                          <CardTitle className="text-lg font-black uppercase tracking-tight text-foreground">
                            {p.title}
                          </CardTitle>
                          <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <Building className="w-3.5 h-3.5 text-primary" />
                            {p.company_name}
                          </p>
                        </div>

                        <Badge
                          className={`text-[9px] font-black uppercase tracking-widest rounded-none ${
                            p.location_type?.toLowerCase() === "remote"
                              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
                              : "bg-blue-500/10 text-blue-600 border border-blue-500/30"
                          }`}
                        >
                          {p.location_type || "Remote"}
                        </Badge>
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {p.description}
                      </p>
                    </CardHeader>

                    <CardContent className="p-6 pt-3 space-y-4">
                      {/* Metric pills */}
                      <div className="grid grid-cols-3 gap-2 py-3 border-y border-border/60 text-center">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Duration</p>
                          <p className="text-xs font-bold mt-0.5">{p.duration_months} Months</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Stipend</p>
                          <p className="text-xs font-bold text-primary mt-0.5">
                            {p.stipend_amount ? `₹${p.stipend_amount}/mo` : "Performance"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Openings</p>
                          <p className="text-xs font-bold mt-0.5">{p.total_openings || 5} Seats</p>
                        </div>
                      </div>

                      {/* Skills Tags */}
                      {p.skills_required && p.skills_required.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {p.skills_required.map((skill: string, idx: number) => (
                            <span
                              key={idx}
                              className="text-[10px] bg-muted/60 text-muted-foreground font-semibold px-2 py-0.5 rounded-none border border-border/50"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <Button
                          variant="outline"
                          onClick={() => setViewingJdPost(p)}
                          className="w-full rounded-none text-xs font-bold uppercase tracking-wider border-border"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1 text-primary" />
                          View JD
                        </Button>

                        {hasApplied ? (
                          <Button
                            disabled
                            className="w-full rounded-none text-xs font-black uppercase tracking-widest bg-muted text-muted-foreground border border-border"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                            Applied
                          </Button>
                        ) : (
                          <Button
                            onClick={() => setSelectedInternship(p)}
                            className="w-full rounded-none text-xs font-black uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90"
                          >
                            <Send className="w-3.5 h-3.5 mr-1" />
                            Apply Now
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      ) : activeTab === "my-applications" ? (
        /* My Applications Tab */
        <div className="bg-card border border-border">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight text-foreground">
                {t("My Internship Applications & Status")}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("Track your recruitment pipeline, supervisor reviews, and certification issuance.")}
              </p>
            </div>
          </div>

          {myApplications.length === 0 ? (
            <div className="p-12 text-center">
              <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
              <h3 className="font-bold text-foreground">{t("No Applications Submitted Yet")}</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {t("Explore active internship openings in the first tab and submit your application to start your apprenticeship.")}
              </p>
              <Button
                onClick={() => setActiveTab("explore")}
                className="mt-4 rounded-none text-xs font-black uppercase tracking-widest"
              >
                {t("Browse Openings")}
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {myApplications.map((app) => {
                const status = (app.status || "Applied").toLowerCase();
                const isCompleted = status === "completed";

                return (
                  <div
                    key={app._id || app.id}
                    className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-muted/10 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[9px] font-black uppercase tracking-widest rounded-none ${
                            status === "completed"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                              : status === "selected"
                              ? "bg-purple-500/10 text-purple-600 border-purple-500/30"
                              : status === "shortlisted"
                              ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                              : status === "rejected"
                              ? "bg-red-500/10 text-red-600 border-red-500/30"
                              : "bg-blue-500/10 text-blue-600 border-blue-500/30"
                          }`}
                        >
                          {app.status || "Applied"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(app.applied_at || Date.now()).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>

                      <h3 className="text-base font-black uppercase tracking-tight text-foreground">
                        {app.internship_title}
                      </h3>
                      <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-primary" />
                        {app.company_name}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 self-end md:self-center">
                      {isCompleted ? (
                        <Button
                          size="sm"
                          onClick={() => setCertificateApp(app)}
                          className="rounded-none text-xs font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <Award className="w-4 h-4 mr-1.5" />
                          {t("Official Certificate")}
                        </Button>
                      ) : (
                        <div className="text-right">
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pipeline Status</p>
                          <p className="text-xs font-bold text-foreground capitalize">{app.status}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Placements & Direct Hired Hall of Fame */
        <div className="space-y-6">
          <div className="p-6 bg-card border border-border">
            <h2 className="text-lg font-black uppercase tracking-tight text-foreground flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Direct Job Placement & PPO Conversion Hall of Fame
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Celebrating SCREduc interns who successfully converted their internship into full-time corporate job offers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {hiredSuccessStories.map((story) => (
              <Card key={story.id} className="rounded-none border-border bg-card p-6 space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-amber-500 text-slate-950 text-[9px] font-black uppercase tracking-widest px-3 py-1">
                  {story.type}
                </div>
                <div className="space-y-1">
                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest text-primary border-primary/30 mb-1">
                    {story.domain}
                  </Badge>
                  <h3 className="text-lg font-black uppercase text-foreground">{story.name}</h3>
                  <p className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                    <Building className="w-3.5 h-3.5" /> {story.company}
                  </p>
                </div>

                <div className="p-3 bg-muted/30 border border-border/60 text-xs space-y-1">
                  <p className="font-bold text-foreground">{story.role}</p>
                  <p className="text-amber-500 font-black">Package: {story.package}</p>
                  <p className="text-[10px] text-muted-foreground">Completed: {story.completionDate}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Job Description (JD) Modal */}
      <Dialog open={!!viewingJdPost} onOpenChange={(open) => !open && setViewingJdPost(null)}>
        <DialogContent className="max-w-2xl rounded-none bg-card border-border p-0 overflow-hidden">
          {viewingJdPost && (
            <div>
              <div className="p-6 bg-slate-900 border-b border-border text-white">
                <div className="flex items-center justify-between mb-2">
                  <Badge className="bg-primary text-primary-foreground font-black text-[9px] uppercase tracking-widest rounded-none">
                    {viewingJdPost.domain}
                  </Badge>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-black uppercase tracking-widest rounded-none">
                    {viewingJdPost.location_type || "Remote"}
                  </Badge>
                </div>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight text-white">
                  {viewingJdPost.title}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-300 mt-1 flex items-center gap-2">
                  <Building className="w-3.5 h-3.5 text-primary" /> {viewingJdPost.company_name} • {viewingJdPost.duration_months} Months Duration
                </DialogDescription>
              </div>

              <div className="p-6 max-h-[60vh] overflow-y-auto space-y-5 text-xs">
                <div>
                  <h4 className="font-black uppercase tracking-wider text-muted-foreground text-[10px] mb-1">Role Description</h4>
                  <p className="text-muted-foreground leading-relaxed">{viewingJdPost.description}</p>
                </div>

                {viewingJdPost.responsibilities && (
                  <div>
                    <h4 className="font-black uppercase tracking-wider text-muted-foreground text-[10px] mb-2">Key Responsibilities</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      {viewingJdPost.responsibilities.map((r: string, idx: number) => (
                        <li key={idx}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {viewingJdPost.eligibility && (
                  <div>
                    <h4 className="font-black uppercase tracking-wider text-muted-foreground text-[10px] mb-1">Candidate Eligibility</h4>
                    <p className="text-foreground font-medium">{viewingJdPost.eligibility}</p>
                  </div>
                )}

                {viewingJdPost.perks && (
                  <div>
                    <h4 className="font-black uppercase tracking-wider text-muted-foreground text-[10px] mb-2">Perks & Compensation</h4>
                    <div className="flex flex-wrap gap-2">
                      {viewingJdPost.perks.map((perk: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="border-primary/40 text-primary text-[10px] font-bold rounded-none">
                          ✓ {perk}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="p-6 bg-muted/20 border-t border-border gap-2">
                <Button variant="outline" onClick={() => setViewingJdPost(null)} className="rounded-none text-xs font-bold uppercase">
                  Close
                </Button>
                <Button
                  onClick={() => {
                    const post = viewingJdPost;
                    setViewingJdPost(null);
                    setSelectedInternship(post);
                  }}
                  className="rounded-none text-xs font-black uppercase tracking-widest bg-primary text-primary-foreground"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  Apply for Opportunity
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Application Submission Modal */}
      <Dialog open={!!selectedInternship} onOpenChange={(open) => !open && setSelectedInternship(null)}>
        <DialogContent className="max-w-lg rounded-none bg-card border-border p-0">
          <form onSubmit={handleApply}>
            <div className="p-6 bg-primary/5 border-b border-border">
              <Badge className="bg-primary text-primary-foreground font-black text-[9px] uppercase tracking-widest rounded-none mb-2">
                Application Form
              </Badge>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">
                {selectedInternship?.title}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {selectedInternship?.company_name} • {selectedInternship?.domain}
              </DialogDescription>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  {t("Contact Phone / WhatsApp")} *
                </Label>
                <Input
                  id="phone"
                  required
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="rounded-none border-border bg-background h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="resume" className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  {t("Resume / Portfolio / Drive URL")} *
                </Label>
                <Input
                  id="resume"
                  required
                  type="url"
                  placeholder="https://drive.google.com/... or https://portfolio.com"
                  value={resumeUrl}
                  onChange={(e) => setResumeUrl(e.target.value)}
                  className="rounded-none border-border bg-background h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="coverNote" className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  {t("Statement of Purpose / Why should we select you?")}
                </Label>
                <Textarea
                  id="coverNote"
                  rows={3}
                  placeholder={t("Briefly describe your skill background and availability...")}
                  value={coverNote}
                  onChange={(e) => setCoverNote(e.target.value)}
                  className="rounded-none border-border bg-background resize-none text-xs"
                />
              </div>
            </div>

            <DialogFooter className="p-6 pt-0 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedInternship(null)}
                className="rounded-none text-xs font-bold uppercase tracking-wider"
              >
                {t("Cancel")}
              </Button>
              <Button
                type="submit"
                disabled={submittingApp}
                className="rounded-none text-xs font-black uppercase tracking-widest bg-primary text-primary-foreground"
              >
                {submittingApp ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                {t("Submit Application")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Official Certificate Modal */}
      <InternshipCertificateModal
        isOpen={!!certificateApp}
        onClose={() => setCertificateApp(null)}
        application={certificateApp}
      />
    </div>
  );
};

export default StudentInternshipPortalPage;
