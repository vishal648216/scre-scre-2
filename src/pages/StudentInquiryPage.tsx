import { useState, useEffect, useMemo } from "react";
import { ChevronRight, PhoneCall, HelpCircle, MessageSquare, GraduationCap, CheckCircle2, User, Smartphone, MapPin, BookOpen, Clock, Award, School, Phone, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectLabel, SelectTrigger, SelectValue, SelectItem } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { courses } from "@/components/CoursesSection";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/api";
import { useLocation } from "react-router-dom";
import { useFormDraft } from "@/hooks/useFormDraft";
import { usePublicSystemSettings } from "@/hooks/usePublicSystemSettings";

type GeoItem = { id: string; name: string; code?: string };

interface Course {
  id: string;
  _id?: string;
  category_id: string;
  course_name: string;
  course_code: string;
  course_type?: string;
  duration_months: number;
  duration_value?: number;
  duration_unit?: string;
  description?: string;
  image_url?: string;
  og_image_url?: string;
  syllabus?: string;
  fees?: number;
  registration_fee?: number;
  exam_fees_applicable?: boolean;
  exam_fee_amount?: number;
  backlog_fees_applicable?: boolean;
  backlog_fee_amount?: number;
  has_course_structure_units?: boolean;
  eligibility?: string;
  status: string;
  created_at: string;
  __categoryName?: string;
}

interface Category {
  id: string;
  _id?: string;
  name: string;
}

const StudentInquiryPage = () => {
  const { t } = useTranslation();
  const { data: systemSettings } = usePublicSystemSettings();
  const location = useLocation();
  
  // Internship Form State
  const initialFormData = {
    name: "",
    phone: "",
    email: "",
    gender: "",
    dob: "",
    qualification: "B.Tech / BE",
    branch: "",
    passingYear: "2026",
    internshipDomain: "",
    internshipMode: "Remote",
    duration: "3 Months",
    resumeUrl: "",
    categoryId: "",
    course: "",
    countryId: "",
    stateId: "",
    districtId: "",
    cityId: "",
    city: "",
    college: "",
    message: "",
    centerId: "",
    preferredTiming: "",
  };
  const [formData, setFormData, clearDraft] = useFormDraft("student_inquiry", initialFormData);
  const [isInternship, setIsInternship] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Contact Form State (for "Request a call back")
  const [contactFormData, setContactFormData] = useState({
    name: "",
    phone: "",
    email: "",
    categoryId: "",
    course: "",
    countryId: "",
    stateId: "",
    districtId: "",
    cityId: "",
    centerId: "",
    message: ""
  });
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactIsSubmitting, setContactIsSubmitting] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [centers, setCenters] = useState<{ id?: string, _id?: string, name: string, code: string, country?: string, state?: string, district?: string, city?: string, location?: any }[]>([]);
  const [centerSearch, setCenterSearch] = useState("");
  const [countries, setCountries] = useState<GeoItem[]>([]);
  const [states, setStates] = useState<GeoItem[]>([]);
  const [districts, setDistricts] = useState<GeoItem[]>([]);
  const [cities, setCities] = useState<GeoItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [colleges, setColleges] = useState<any[]>([]);
  const [countryById, setCountryById] = useState<Record<string, string>>({});
  const [stateById, setStateById] = useState<Record<string, string>>({});
  const [districtById, setDistrictById] = useState<Record<string, string>>({});
  const [cityById, setCityById] = useState<Record<string, string>>({});

  const faqs = [
    {
      question: t("Which course is best for my career?"),
      answer: t("The 'best' course depends on your career goals. For accounting, Tally Prime is excellent. For creative fields, Graphic Designing is ideal. Our counselors can help you decide based on your background.")
    },
    {
      question: t("What are the fee details?"),
      answer: t("Fees vary by course and duration. We offer flexible payment plans and occasional scholarships. Get a free consultation for a detailed fee structure of your interested course.")
    },
    {
      question: t("How long are the courses?"),
      answer: t("Our courses range from short-term certifications (3 months) to advanced diplomas (1 year). We also have fast-track options for experienced learners.")
    },
    {
      question: t("Do you provide job assistance?"),
      answer: t("Yes, we provide 100% placement assistance, including resume building, mock interviews, and direct connections with our hiring partners.")
    }
  ];

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const domain = params.get("domain");
    const source = params.get("source");
    
    if (domain) {
      setFormData(prev => ({ ...prev, course: domain }));
    }
    
    if (source === "internship") {
      setIsInternship(true);
    }

    fetchData();
  }, [location.search]);

  const fetchData = async () => {
    try {
      const [centersRes, coursesRes, catsRes, collegesRes] = await Promise.all([
        apiFetch("/api/public/centers"),
        apiFetch("/api/public/courses?status=active"),
        apiFetch("/api/public/categories?status=active"),
        apiFetch("/api/public/colleges"),
      ]);

      if (centersRes.ok) {
        const result = await centersRes.json();
        const data = result?.data || [];
        console.log("Fetched centers:", data);
        setCenters(Array.isArray(data) ? data : []);
      }

      if (coursesRes.ok) {
        const data = await coursesRes.json();
        console.log("courses data:", data);
        setCourses(Array.isArray(data) ? data : []);
      }

      if (catsRes.ok) {
        const data = await catsRes.json();
        console.log("categories data:", data);
        setCategories(Array.isArray(data?.items) ? data.items : []);
      }

      if (collegesRes.ok) {
        const data = await collegesRes.json();
        console.log("colleges data:", data);
        setColleges(Array.isArray(data) ? data : []);
      }

      fetchCountries();
    } catch (err) {
      console.error("Failed to fetch data:", err);
    }
  };

  const fetchCountries = async () => {
    try {
      const res = await apiFetch("/api/public/locations/countries");
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setCountries(list);
        const map: Record<string, string> = {};
        list.forEach((item: GeoItem) => {
          if (item.id) map[item.id] = item.name;
        });
        setCountryById(map);
      }
    } catch (err) {
      console.error("Failed to fetch countries", err);
    }
  };

  const fetchStates = async (countryId: string) => {
    try {
      const res = await apiFetch(`/api/public/locations/states?country_id=${encodeURIComponent(countryId)}`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setStates(list);
        const map: Record<string, string> = {};
        list.forEach((item: GeoItem) => {
          if (item.id) map[item.id] = item.name;
        });
        setStateById(map);
      }
    } catch (err) {
      console.error("Failed to fetch states", err);
    }
  };

  const fetchDistricts = async (stateId: string) => {
    try {
      const res = await apiFetch(`/api/public/locations/districts?state_id=${encodeURIComponent(stateId)}`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setDistricts(list);
        const map: Record<string, string> = {};
        list.forEach((item: GeoItem) => {
          if (item.id) map[item.id] = item.name;
        });
        setDistrictById(map);
      }
    } catch (err) {
      console.error("Failed to fetch districts", err);
    }
  };

  const fetchCities = async (districtId: string) => {
    try {
      const res = await apiFetch(`/api/public/locations/cities?district_id=${encodeURIComponent(districtId)}`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setCities(list);
        const map: Record<string, string> = {};
        list.forEach((item: GeoItem) => {
          if (item.id) map[item.id] = item.name;
        });
        setCityById(map);
      }
    } catch (err) {
      console.error("Failed to fetch cities", err);
    }
  };

  // Internship Form Handlers
  const handleInternshipCountryChange = (countryId: string) => {
    setFormData({
      ...formData,
      countryId,
      stateId: "",
      districtId: "",
      cityId: ""
    });
    if (countryId) {
      fetchStates(countryId);
    } else {
      setStates([]);
      setDistricts([]);
      setCities([]);
    }
  };

  const handleInternshipStateChange = (stateId: string) => {
    setFormData({
      ...formData,
      stateId,
      districtId: "",
      cityId: ""
    });
    if (stateId) {
      fetchDistricts(stateId);
    } else {
      setDistricts([]);
      setCities([]);
    }
  };

  const handleInternshipDistrictChange = (districtId: string) => {
    setFormData({
      ...formData,
      districtId,
      cityId: ""
    });
    if (districtId) {
      fetchCities(districtId);
    } else {
      setCities([]);
    }
  };

  const handleInternshipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const enquiryType = "internship";
      const response = await apiFetch("/api/contact", {
        method: "POST",
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          qualification: formData.qualification,
          branch: formData.branch,
          passing_year: formData.passingYear,
          internship_domain: formData.internshipDomain || formData.course,
          internship_mode: formData.internshipMode,
          duration: formData.duration,
          resume_url: formData.resumeUrl,
          gender: formData.gender,
          dob: formData.dob,
          category_id: formData.categoryId || undefined,
          course: formData.course || formData.internshipDomain,
          country_id: formData.countryId || undefined,
          state_id: formData.stateId || undefined,
          district_id: formData.districtId || undefined,
          city_id: formData.cityId || undefined,
          center_id: formData.centerId || undefined,
          college: formData.college || undefined,
          message: formData.message || undefined,
          subject: `Internship Inquiry: ${formData.internshipDomain || formData.course}`,
          enquiry_type: enquiryType
        })
      });

      if (response.ok) {
        setIsSubmitted(true);
        toast.success(t("Inquiry sent successfully!"));
        clearDraft();
        setFormData(initialFormData);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        toast.error(t("Failed to send inquiry. Please try again."));
      }
    } catch (error) {
      toast.error(t("An error occurred. Please try again later."));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Contact Form Handlers
  const handleContactCountryChange = (countryId: string) => {
    setContactFormData({
      ...contactFormData,
      countryId,
      stateId: "",
      districtId: "",
      cityId: "",
      centerId: ""
    });
    if (countryId) {
      fetchStates(countryId);
    } else {
      setStates([]);
      setDistricts([]);
      setCities([]);
    }
  };

  const handleContactStateChange = (stateId: string) => {
    setContactFormData({
      ...contactFormData,
      stateId,
      districtId: "",
      cityId: "",
      centerId: ""
    });
    if (stateId) {
      fetchDistricts(stateId);
    } else {
      setDistricts([]);
      setCities([]);
    }
  };

  const handleContactDistrictChange = (districtId: string) => {
    setContactFormData({
      ...contactFormData,
      districtId,
      cityId: "",
      centerId: ""
    });
    if (districtId) {
      fetchCities(districtId);
    } else {
      setCities([]);
    }
  };

  const handleContactCityChange = (cityId: string) => {
    setContactFormData({
      ...contactFormData,
      cityId,
      centerId: ""
    });
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (contactIsSubmitting) return;

    // Basic validation
    const trimmedPhone = contactFormData.phone.trim();
    if (!/^\d{10,15}$/.test(trimmedPhone)) {
      setContactError(t("Please enter a valid phone number (10-15 digits)"));
      return;
    }

    setContactError(null);
    setContactIsSubmitting(true);
    try {
      const response = await apiFetch("/api/contact", {
        method: "POST",
        body: JSON.stringify({
          name: contactFormData.name.trim(),
          phone: trimmedPhone,
          email: contactFormData.email.trim() || undefined,
          category_id: contactFormData.categoryId || undefined,
          course: contactFormData.course,
          country_id: contactFormData.countryId || undefined,
          state_id: contactFormData.stateId || undefined,
          district_id: contactFormData.districtId || undefined,
          city_id: contactFormData.cityId || undefined,
          center_id: contactFormData.centerId || undefined,
          message: contactFormData.message.trim() || undefined,
        }),
      });

      if (response.ok) {
        setContactSubmitted(true);
        setTimeout(() => setContactSubmitted(false), 3000);
        setContactFormData({
          name: "",
          phone: "",
          email: "",
          categoryId: "",
          course: "",
          countryId: "",
          stateId: "",
          districtId: "",
          cityId: "",
          centerId: "",
          message: ""
        });
      } else {
        const data = await response.json().catch(() => ({}));
        setContactError(data.message || t("Failed to submit enquiry. Please try again."));
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      setContactError(t("An error occurred. Please try again later."));
    } finally {
      setContactIsSubmitting(false);
    }
  };

  const safeCenters = Array.isArray(centers) ? centers : [];
  const filteredCourses = contactFormData.categoryId
    ? courses.filter(c => c.category_id === contactFormData.categoryId)
    : courses;
  const filteredInternshipCourses = formData.categoryId
    ? courses.filter(c => c.category_id === formData.categoryId)
    : courses;
  const filteredCenters = safeCenters.filter(c => {
    const matchesSearch =
      centerSearch === "" ||
      (c.name && c.name.toLowerCase().includes(centerSearch.toLowerCase())) ||
      (c.code && c.code.toLowerCase().includes(centerSearch.toLowerCase()));

    let matchesCountry = true;
    if (contactFormData.countryId && countryById[contactFormData.countryId]) {
      const selected = countryById[contactFormData.countryId].toLowerCase().trim();
      const centerVal = (c.country || c.location?.country || "").toLowerCase().trim();
      matchesCountry = centerVal.includes(selected) || selected.includes(centerVal);
    }

    let matchesState = true;
    if (contactFormData.stateId && stateById[contactFormData.stateId]) {
      const selected = stateById[contactFormData.stateId].toLowerCase().trim();
      const centerVal = (c.state || c.location?.state || "").toLowerCase().trim();
      matchesState = centerVal.includes(selected) || selected.includes(centerVal);
    }

    let matchesDistrict = true;
    if (contactFormData.districtId && districtById[contactFormData.districtId]) {
      const selected = districtById[contactFormData.districtId].toLowerCase().trim();
      const centerVal = (c.district || c.location?.district || "").toLowerCase().trim();
      matchesDistrict = centerVal.includes(selected) || selected.includes(centerVal);
    }

    let matchesCity = true;
    if (contactFormData.cityId && cityById[contactFormData.cityId]) {
      const selected = cityById[contactFormData.cityId].toLowerCase().trim();
      const centerVal = (c.city || c.location?.city || "").toLowerCase().trim();
      matchesCity = centerVal.includes(selected) || selected.includes(centerVal);
    }

    return matchesSearch && matchesCountry && matchesState && matchesDistrict && matchesCity;
  });

  const coursesByCategory = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    courses.forEach(course => {
      const catId = course.category_id || "other";
      if (!grouped[catId]) grouped[catId] = [];
      grouped[catId].push(course);
    });
    return grouped;
  }, [courses]);

  const getCategoryName = (id: string) => {
    if (id === "other") return t("Other Programs");
    const cat = categories.find(c => (c.id === id || c._id === id));
    return cat ? t(cat.name) : t("Other Programs");
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-8 text-center border-none shadow-2xl bg-card animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
              <PhoneCall className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-extrabold text-foreground mb-4">{t("Talk to you soon!")}</h2>
            <p className="text-muted-foreground mb-8 text-lg">
              {t("Our expert counselor will contact you within 24 hours to provide the guidance you need.")}
            </p>
            <Button className="w-full py-6 text-lg font-bold rounded-xl" onClick={() => setIsSubmitted(false)}>
              {t("Back to Inquiry")}
            </Button>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative py-20 md:py-28 overflow-hidden bg-[#0F172A] text-white">
          <div className="container mx-auto px-4 relative z-10 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 text-xs font-bold tracking-widest uppercase bg-primary/20 text-primary-foreground border border-primary/30 rounded-full backdrop-blur-md">
              <HelpCircle className="w-4 h-4" /> {t("Expert Guidance")}
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-6">
              {t("Not Sure Which")} <br />
              <span className="text-primary">{t("Course to Choose?")}</span>
            </h1>
            <p className="max-w-xl mx-auto text-lg text-slate-300 mb-10">
              {t("Stop guessing. Get free, personalized career counseling from our industry experts today.")}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" className="h-14 px-8 text-lg font-bold rounded-full bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => document.getElementById('inquiry-form')?.scrollIntoView({ behavior: 'smooth' })}>
                {t("Get Free Consultation")}
              </Button>
              <Button size="lg" variant="outline" className="h-14 px-8 text-lg font-bold rounded-full border-white/20 hover:bg-white/10 text-white">
                {t("View All Courses")}
              </Button>
            </div>
          </div>
          
          {/* Abstract background shapes */}
          <div className="absolute top-0 right-0 w-1/3 h-full bg-primary/10 blur-[120px] rounded-full translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-1/4 h-1/2 bg-blue-500/10 blur-[100px] rounded-full -translate-x-1/2"></div>
        </section>

        {/* Benefits Section */}
        <section className="py-20 container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-none bg-muted/30 shadow-none hover:bg-muted/50 transition-colors">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-background rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                  <MessageSquare className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">{t("Free Counseling")}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {t("One-on-one session with our experts to understand your interests and strengths.")}
                </p>
              </CardContent>
            </Card>
            <Card className="border-none bg-muted/30 shadow-none hover:bg-muted/50 transition-colors">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-background rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                  <GraduationCap className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">{t("Course Guidance")}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {t("Detailed breakdown of modules, projects, and learning outcomes for every course.")}
                </p>
              </CardContent>
            </Card>
            <Card className="border-none bg-muted/30 shadow-none hover:bg-muted/50 transition-colors">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-background rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                  <Award className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">{t("Career Advice")}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {t("Learn about job market trends, salary expectations, and placement opportunities.")}
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Inquiry Form Section */}
        <section id="inquiry-form" className="py-20 bg-muted/20">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-black mb-6">{t("Ready to take the first step?")}</h2>
                <p className="text-muted-foreground text-lg mb-8">
                  {t("Fill in this short form and we'll handle the rest. No commitment required, just professional advice.")}
                </p>
                
                <ul className="space-y-4">
                  {[
                    t("Response within 24 business hours"),
                    t("Personalized roadmap based on your goals"),
                    t("No spam, only valuable information"),
                    t("Trusted by 5000+ students across the country")
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 font-medium">
                      <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {isInternship ? (
                <Card className="border-none shadow-2xl shadow-primary/5 p-2 rounded-3xl overflow-hidden">
                  <div className="bg-primary p-6 text-primary-foreground text-center">
                    <h3 className="text-xl font-bold">{t("Apply for Internship")}</h3>
                  </div>
                  <CardContent className="p-8">
                    <form onSubmit={handleInternshipSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider opacity-70">{t("Your Full Name")}</Label>
                        <div className="relative">
                          <Input 
                            id="name" 
                            placeholder={t("Your Full Name")}
                            className="h-12 rounded-xl pl-10 bg-muted/50 border border-border focus-visible:ring-primary"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                          />
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider opacity-70">{t("Phone Number")}</Label>
                        <div className="relative">
                          <Input 
                            id="phone" 
                            placeholder={t("Phone Number")}
                            className="h-12 rounded-xl pl-10 bg-muted/50 border border-border focus-visible:ring-primary"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            maxLength={15}
                            required
                          />
                          <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider opacity-70">{t("Email Address (Optional)")}</Label>
                        <div className="relative">
                          <Input 
                            id="email" 
                            type="email"
                            placeholder={t("Email Address (Optional)")}
                            className="h-12 rounded-xl pl-10 bg-muted/50 border border-border focus-visible:ring-primary"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          />
                          <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="categoryId" className="text-xs font-bold uppercase tracking-wider opacity-70">{t("Internship Category")}</Label>
                        <Select value={formData.categoryId} onValueChange={(val) => setFormData({ ...formData, categoryId: val, course: "" })} required>
                          <SelectTrigger className="h-12 rounded-xl bg-muted/50 border border-border focus:ring-primary">
                            <SelectValue placeholder={t("Select Category")} />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((cat) => (
                              <SelectItem key={cat.id || cat._id} value={cat.id || cat._id}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="course" className="text-xs font-bold uppercase tracking-wider opacity-70">{t("Select Internship (Course)")}</Label>
                        <Select value={formData.course} onValueChange={(val) => setFormData({ ...formData, course: val })} required disabled={!formData.categoryId}>
                          <SelectTrigger className="h-12 rounded-xl bg-muted/50 border border-border focus:ring-primary">
                            <SelectValue placeholder={t("Select Internship (Course)")} />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredInternshipCourses.map((course) => (
                              <SelectItem key={course.id || course._id} value={course.course_name}>
                                {course.course_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="countryId" className="text-xs font-bold uppercase tracking-wider opacity-70">{t("Country")}</Label>
                        <Select value={formData.countryId} onValueChange={handleInternshipCountryChange} required>
                          <SelectTrigger className="h-12 rounded-xl bg-muted/50 border border-border focus:ring-primary">
                            <SelectValue placeholder={t("Select Country")} />
                          </SelectTrigger>
                          <SelectContent>
                            {countries.map((country) => (
                              <SelectItem key={country.id} value={country.id}>
                                {country.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {formData.countryId && (
                        <div className="space-y-2">
                          <Label htmlFor="stateId" className="text-xs font-bold uppercase tracking-wider opacity-70">{t("State")}</Label>
                          <Select value={formData.stateId} onValueChange={handleInternshipStateChange} required>
                            <SelectTrigger className="h-12 rounded-xl bg-muted/50 border border-border focus:ring-primary">
                              <SelectValue placeholder={t("Select State")} />
                            </SelectTrigger>
                            <SelectContent>
                              {states.map((state) => (
                                <SelectItem key={state.id} value={state.id}>
                                  {state.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {formData.stateId && (
                        <div className="space-y-2">
                          <Label htmlFor="districtId" className="text-xs font-bold uppercase tracking-wider opacity-70">{t("District")}</Label>
                          <Select value={formData.districtId} onValueChange={handleInternshipDistrictChange} required>
                            <SelectTrigger className="h-12 rounded-xl bg-muted/50 border border-border focus:ring-primary">
                              <SelectValue placeholder={t("Select District")} />
                            </SelectTrigger>
                            <SelectContent>
                              {districts.map((district) => (
                                <SelectItem key={district.id} value={district.id}>
                                  {district.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {formData.districtId && (
                        <div className="space-y-2">
                          <Label htmlFor="cityId" className="text-xs font-bold uppercase tracking-wider opacity-70">{t("City")}</Label>
                          <Select value={formData.cityId} onValueChange={(val) => setFormData({ ...formData, cityId: val })} required>
                            <SelectTrigger className="h-12 rounded-xl bg-muted/50 border border-border focus:ring-primary">
                              <SelectValue placeholder={t("Select City")} />
                            </SelectTrigger>
                            <SelectContent>
                              {cities.map((city) => (
                                <SelectItem key={city.id} value={city.id}>
                                  {city.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="college" className="text-xs font-bold uppercase tracking-wider opacity-70">{t("College / University")}</Label>
                        <div className="relative">
                          <Select value={formData.college} onValueChange={(val) => setFormData({ ...formData, college: val })}>
                            <SelectTrigger className="h-12 rounded-xl bg-muted/50 border border-border focus:ring-primary pl-10">
                              <SelectValue placeholder={t("Select College")} />
                            </SelectTrigger>
                            <SelectContent>
                              {colleges.map((college) => (
                                <SelectItem key={college._id} value={college.name}>
                                  {college.name}
                                </SelectItem>
                              ))}
                              <SelectItem value="other">{t("Other (Enter manually)")}</SelectItem>
                            </SelectContent>
                          </Select>
                          <School className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        </div>
                        {formData.college === "other" && (
                          <Input 
                            id="college-other" 
                            placeholder={t("Enter College Name")}
                            className="h-12 rounded-xl bg-muted/50 border border-border focus-visible:ring-primary mt-2"
                            onChange={(e) => setFormData({ ...formData, college: e.target.value })}
                          />
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="message" className="text-xs font-bold uppercase tracking-wider opacity-70">{t("Message (Optional)")}</Label>
                        <textarea
                          id="message"
                          placeholder={t("Tell us more about yourself...")}
                          rows={3}
                          className="w-full px-4 py-3 rounded-xl border border-border bg-muted/50 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                          value={formData.message}
                          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        />
                      </div>

                      <Button type="submit" disabled={isSubmitting} className="w-full bg-gradient-to-r from-primary to-primary-dark text-primary-foreground px-6 py-4 rounded-xl font-bold text-base hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                        {isSubmitting ? (
                          <span className="animate-spin">⏳</span>
                        ) : (
                          <Send className="w-5 h-5" />
                        )}
                        {isSubmitting ? t("Submitting...") : t("Submit Application")}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid lg:grid-cols-1 gap-8">
                  <div className="bg-card rounded-2xl p-6 md:p-8 shadow-xl border border-border">
                    <h3 className="font-bold text-xl text-foreground mb-6">
                      {t("Send Us Your Enquiry")}
                    </h3>
                    {contactSubmitted && (
                      <div className="bg-secondary/10 text-secondary rounded-xl p-4 mb-6 font-semibold text-sm">
                        ✅ {t("Thank you! We'll contact you soon.")}
                      </div>
                    )}
                    {contactError && (
                      <div className="bg-destructive/10 text-destructive rounded-xl p-4 mb-6 font-semibold text-sm">
                        ❌ {t(contactError)}
                      </div>
                    )}
                    <form onSubmit={handleContactSubmit} className="space-y-4">
                      <input
                        type="text"
                        required
                        placeholder={t("Your Full Name")}
                        maxLength={100}
                        className="w-full px-4 py-3.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                        value={contactFormData.name}
                        onChange={(e) => setContactFormData({ ...contactFormData, name: e.target.value })}
                        disabled={contactIsSubmitting || contactSubmitted}
                      />
                      <input
                        type="tel"
                        required
                        placeholder={t("Phone Number")}
                        maxLength={15}
                        className="w-full px-4 py-3.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                        value={contactFormData.phone}
                        onChange={(e) => setContactFormData({ ...contactFormData, phone: e.target.value })}
                        disabled={contactIsSubmitting || contactSubmitted}
                      />
                      <input
                        type="email"
                        placeholder={t("Email Address (Optional)")}
                        maxLength={255}
                        className="w-full px-4 py-3.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                        value={contactFormData.email}
                        onChange={(e) => setContactFormData({ ...contactFormData, email: e.target.value })}
                        disabled={contactIsSubmitting || contactSubmitted}
                      />
                      <select
                        required
                        className="w-full px-4 py-3.5 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                        value={contactFormData.categoryId}
                        onChange={(e) => setContactFormData({ ...contactFormData, categoryId: e.target.value, course: "" })}
                        disabled={contactIsSubmitting || contactSubmitted}
                      >
                        <option value="">{t("Select Category")}</option>
                        {categories.map((cat) => (
                          <option key={cat.id || cat._id} value={cat.id || cat._id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                      <select
                        required
                        className="w-full px-4 py-3.5 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                        value={contactFormData.course}
                        onChange={(e) => setContactFormData({ ...contactFormData, course: e.target.value })}
                        disabled={contactIsSubmitting || contactSubmitted || !contactFormData.categoryId}
                      >
                        <option value="">{t("Select Course")}</option>
                        {filteredCourses.map((course) => (
                          <option key={course.id || course._id} value={course.course_name}>
                            {course.course_name}
                          </option>
                        ))}
                      </select>
                      <select
                        required
                        className="w-full px-4 py-3.5 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                        value={contactFormData.countryId}
                        onChange={(e) => handleContactCountryChange(e.target.value)}
                        disabled={contactIsSubmitting || contactSubmitted}
                      >
                        <option value="">{t("Select Country")}</option>
                        {countries.map((country) => (
                          <option key={country.id} value={country.id}>
                            {country.name}
                          </option>
                        ))}
                      </select>
                      <select
                        className="w-full px-4 py-3.5 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                        value={contactFormData.stateId}
                        onChange={(e) => handleContactStateChange(e.target.value)}
                        disabled={contactIsSubmitting || contactSubmitted || !contactFormData.countryId}
                      >
                        <option value="">{t("Select State")}</option>
                        {states.map((state) => (
                          <option key={state.id} value={state.id}>
                            {state.name}
                          </option>
                        ))}
                      </select>
                      <select
                        className="w-full px-4 py-3.5 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                        value={contactFormData.districtId}
                        onChange={(e) => handleContactDistrictChange(e.target.value)}
                        disabled={contactIsSubmitting || contactSubmitted || !contactFormData.stateId}
                      >
                        <option value="">{t("Select District")}</option>
                        {districts.map((district) => (
                          <option key={district.id} value={district.id}>
                            {district.name}
                          </option>
                        ))}
                      </select>
                      <select
                        className="w-full px-4 py-3.5 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                        value={contactFormData.cityId}
                        onChange={(e) => handleContactCityChange(e.target.value)}
                        disabled={contactIsSubmitting || contactSubmitted || !contactFormData.districtId}
                      >
                        <option value="">{t("Select City")}</option>
                        {cities.map((city) => (
                          <option key={city.id} value={city.id}>
                            {city.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder={t("Search Center by Name or Code")}
                        className="w-full px-4 py-3.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                        value={centerSearch}
                        onChange={(e) => setCenterSearch(e.target.value)}
                        disabled={contactIsSubmitting || contactSubmitted}
                      />
                      <select
                        className="w-full px-4 py-3.5 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                        value={contactFormData.centerId}
                        onChange={(e) => setContactFormData({ ...contactFormData, centerId: e.target.value })}
                        disabled={contactIsSubmitting || contactSubmitted}
                      >
                        <option value="">{t("Select Center (Optional)")}</option>
                        {filteredCenters.map((center) => (
                          <option key={center.id || center._id} value={center.id || center._id}>
                            {center.name} ({center.code})
                          </option>
                        ))}
                      </select>
                      <textarea
                        placeholder={t("Message (Optional)")}
                        rows={3}
                        className="w-full px-4 py-3.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                        value={contactFormData.message}
                        onChange={(e) => setContactFormData({ ...contactFormData, message: e.target.value })}
                        disabled={contactIsSubmitting || contactSubmitted}
                      />

                      <button
                        type="submit"
                        disabled={contactIsSubmitting || contactSubmitted}
                        className="w-full bg-gradient-to-r from-primary to-primary-dark text-primary-foreground px-6 py-4 rounded-xl font-bold text-base hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {contactIsSubmitting ? (
                          <span className="animate-spin">⏳</span>
                        ) : (
                          <Send className="w-5 h-5" />
                        )}
                        {contactIsSubmitting ? t("Submitting...") : t("Submit Enquiry")}
                      </button>
                    </form>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-card rounded-2xl p-6 md:p-8 shadow-xl border border-border">
                      <h3 className="font-bold text-xl text-foreground mb-6">
                        {t("Contact Information")}
                      </h3>
                      <div className="space-y-5">
                        <a href={`tel:${(systemSettings?.contact_phone as string) || "+919466317100"}`} className="flex items-start gap-4 group">
                          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shrink-0 shadow-md">
                            <Phone className="w-5 h-5 text-primary-foreground" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{t("Phone")}</p>
                            <p className="text-muted-foreground text-sm">{(systemSettings?.contact_phone as string) || "+91 94663 17100"}</p>
                          </div>
                        </a>
                        <a href={`mailto:${(systemSettings?.contact_email as string) || "info@screduc.com"}`} className="flex items-start gap-4 group">
                          <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center shrink-0 shadow-md">
                            <Mail className="w-5 h-5 text-secondary-foreground" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{t("Email")}</p>
                            <p className="text-muted-foreground text-sm">{(systemSettings?.contact_email as string) || "info@screduc.com"}</p>
                          </div>
                        </a>
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center shrink-0 shadow-md">
                            <MapPin className="w-5 h-5 text-accent-foreground" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{t("Address")}</p>
                            <p className="text-muted-foreground text-sm">
                              {(systemSettings?.contact_address as string) || "# 785/10 Main Bazar Jeweler Market , opposite N.R, Jeweler, Jind, Haryana 126102"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl overflow-hidden shadow-xl border border-border h-64">
                      <iframe
                        title={t("Location Map")}
                        src={(systemSettings?.contact_map_url as string) || "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3500!2d76.8!3d28.9!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMjjCsDU0JzAwLjAiTiA3NsKwNDgnMDAuMCJF!5e0!3m2!1sen!2sin!4v1"}
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        allowFullScreen
                        loading="lazy"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-20 container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black mb-4">{t("Frequently Asked Questions")}</h2>
            <p className="text-muted-foreground">{t("Quick answers to common questions about our training programs.")}</p>
          </div>
          
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border-b border-muted py-2">
                <AccordionTrigger className="text-left font-bold hover:no-underline hover:text-primary transition-colors">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pt-2">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* Final CTA / Trust Section */}
        <section className="py-20 bg-primary text-primary-foreground text-center">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-black mb-6">{t("Join 10,000+ Successful Students")}</h2>
            <p className="text-lg opacity-90 max-w-2xl mx-auto mb-10">
              {t("Start your career with the most trusted computer training institute. Your success story begins here.")}
            </p>
            <div className="flex justify-center items-center gap-12 flex-wrap">
              <div>
                <div className="text-4xl font-black mb-1">{t("5000+")}</div>
                <div className="text-xs font-bold uppercase tracking-widest opacity-70">{t("Students Guided")}</div>
              </div>
              <div className="w-px h-12 bg-primary-foreground/20 hidden md:block"></div>
              <div>
                <div className="text-4xl font-black mb-1">{t("< 24h")}</div>
                <div className="text-xs font-bold uppercase tracking-widest opacity-70">{t("Response Time")}</div>
              </div>
              <div className="w-px h-12 bg-primary-foreground/20 hidden md:block"></div>
              <div>
                <div className="text-4xl font-black mb-1">{t("98%")}</div>
                <div className="text-xs font-bold uppercase tracking-widest opacity-70">{t("Satisfaction")}</div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default StudentInquiryPage;
