import { useState, useEffect, useMemo } from "react";
import { CheckCircle2, ChevronRight, ChevronLeft, Upload, Smartphone, MapPin, GraduationCap, Clock, Monitor, User, ShieldCheck, Users, Award, BookOpen, Gift, Sparkles, Search, Loader2, QrCode, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { InputOTP, InputOTPSlot, InputOTPGroup } from "@/components/ui/input-otp";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { courses } from "@/components/CoursesSection";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/api";
import { loadRazorpayScript } from "@/lib/loadRazorpay";
import { stripHtml } from "@/lib/courseDisplay";
import { SyllabusCoverageModal } from "@/components/SyllabusCoverageModal";
import { Badge } from "@/components/ui/badge";
import { useSearchParams } from "react-router-dom";

interface CountryFeeRule {
  country_code: string;
  country_name: string;
  currency_code: string;
  currency_symbol: string;
  multiplier: number;
}

const AdmissionPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const steps = [
    { id: 1, title: t("Course"), icon: <BookOpen className="w-4 h-4" /> },
    { id: 2, title: t("Identity"), icon: <User className="w-4 h-4" /> },
    { id: 3, title: t("Details"), icon: <MapPin className="w-4 h-4" /> },
    { id: 4, title: t("Preferences"), icon: <Clock className="w-4 h-4" /> },
    { id: 5, title: t("Payment"), icon: <Smartphone className="w-4 h-4" /> },
  ];
  const [currentStep, setCurrentStep] = useState(0); // 0 is hero, 1 is course selection, then form steps
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [centers, setCenters] = useState<{ id: string, name: string }[]>([]);
  const [centerBatches, setCenterBatches] = useState<any[]>([]);
  const [apiCourses, setApiCourses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [countryFeeRules, setCountryFeeRules] = useState<CountryFeeRule[]>([]);
  const [selectedCountryFee, setSelectedCountryFee] = useState<CountryFeeRule>({
    country_code: "IN",
    country_name: "India",
    currency_code: "INR",
    currency_symbol: "₹",
    multiplier: 1.0,
  });
  const [formData, setFormData] = useState({
    course: "",
    courseId: "",
    registrationFee: 2000,
    name: "",
    fatherName: "",
    motherName: "",
    mobile: "",
    otp: "",
    email: "",
    dob: "",
    gender: "",
    address: "",
    city: "",
    state: "",
    country: "",
    pincode: "",
    otherAddress: "",
    category: "General",
    otherCategory: "",
    nationalIdType: "Passport",
    otherNationalIdType: "",
    nationalId: "",
    qualification: "",
    center: "",
    batch: "",
    mode: "",
    photo: null,
    idProof: null,
    otherDocName: "",
    otherDocUrl: "",
    coupon_code: "",
    referral_code: "",
  });

  useEffect(() => {
    const nameParam = searchParams.get("name");
    const phoneParam = searchParams.get("phone");
    const emailParam = searchParams.get("email");
    const courseParam = searchParams.get("course");
    const courseIdParam = searchParams.get("course_id");

    if (nameParam || phoneParam || emailParam || courseParam) {
      setFormData((prev) => ({
        ...prev,
        name: nameParam || prev.name,
        mobile: phoneParam || prev.mobile,
        email: emailParam || prev.email,
        course: courseParam || prev.course,
        courseId: courseIdParam || prev.courseId,
      }));
      setCurrentStep(1);
      toast.success(t("Applicant details pre-filled from Enquiry Register!"));
    }
  }, [searchParams]);

  const [showExistingStudentModal, setShowExistingStudentModal] = useState(false);
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookingUp, setLookingUp] = useState(false);

  const handleLookupExistingStudent = async () => {
    const cleanQuery = lookupQuery.trim();
    if (!cleanQuery) return;
    setLookingUp(true);
    try {
      const res = await apiFetch(`/api/public/verify-student?query=${encodeURIComponent(cleanQuery)}`);
      const data = await res.json();
      if (res.ok && data.success && data.student) {
        const s = data.student;
        setFormData((prev) => ({
          ...prev,
          name: s.full_name || prev.name,
          fatherName: s.father_name || prev.fatherName,
          dob: s.dob || prev.dob,
        }));
        setOtpVerified(true);
        setShowExistingStudentModal(false);
        toast.success(t("Student profile loaded! You can now enroll in an additional course under your account."));
      } else {
        toast.error(data.message || t("Student record not found"));
      }
    } catch {
      toast.error(t("Failed to lookup student"));
    } finally {
      setLookingUp(false);
    }
  };

  const [couponInfo, setCouponInfo] = useState<{ discount_type: string, discount_value: number } | null>(null);
  const [syllabusModalOpen, setSyllabusModalOpen] = useState(false);
  const [syllabusModalCourse, setSyllabusModalCourse] = useState<any>(null);
  const [referralValidated, setReferralValidated] = useState<{
    valid: boolean;
    user_name?: string;
    user_role?: string;
    message?: string;
  } | null>(null);
  const [validatingReferral, setValidatingReferral] = useState(false);

  const validateReferral = async (code: string) => {
    const clean = code.trim();
    if (!clean) {
      setReferralValidated(null);
      return;
    }
    setValidatingReferral(true);
    try {
      const res = await apiFetch("/api/referrals/validate", {
        method: "POST",
        body: JSON.stringify({ code: clean }),
      });
      const data = await res.json();
      if (data.success && data.valid) {
        setReferralValidated({
          valid: true,
          user_name: data.user_name,
          user_role: data.user_role,
          message: data.message,
        });
        toast.success(
          t("Referral verified: {{name}} ({{role}})", {
            name: data.user_name || "Partner",
            role: data.user_role || "Referrer",
          })
        );
      } else {
        setReferralValidated({
          valid: false,
          message: data.message || t("Invalid referral code"),
        });
        toast.error(data.message || t("Invalid referral code"));
      }
    } catch {
      setReferralValidated({ valid: false, message: t("Validation error") });
      toast.error(t("Failed to validate referral code"));
    } finally {
      setValidatingReferral(false);
    }
  };

  const validateCoupon = async (code: string) => {
    if (!code) {
      setCouponInfo(null);
      return;
    }
    try {
      const res = await apiFetch(`/api/coupons/validate?code=${code}&coupon_type=student`);
      if (res.ok) {
        const data = await res.json();
        setCouponInfo({
          discount_type: data.discount_type,
          discount_value: data.discount_value
        });
        toast.success(t("Coupon applied: {{value}}{{type}} off", {
          value: data.discount_value,
          type: data.discount_type === 'percentage' ? '%' : ''
        }));
      } else {
        const data = await res.json().catch(() => ({}));
        setCouponInfo(null);
        toast.error(data.message || t("Invalid or expired coupon"));
      }
    } catch {
      setCouponInfo(null);
      toast.error(t("Failed to validate coupon"));
    }
  };

  useEffect(() => {
    const fetchCenters = async () => {
      try {
        const res = await apiFetch("/api/public/centers");
        if (res.ok) {
          const data = await res.json();
          setCenters(
            (data || [])
              .map((c: any) => ({
                id: String(c.id ?? c._id ?? c.code ?? "").trim(),
                name: String(c.name ?? "").trim(),
              }))
              .filter((x: any) => x.id && x.name),
          );
        }
      } catch (err) {
        console.error("Failed to fetch centers");
      }
    };
    const fetchCourses = async () => {
      try {
        const [coursesRes, catsRes] = await Promise.all([
          apiFetch("/api/public/courses"),
          apiFetch("/api/public/categories"),
        ]);
        if (coursesRes.ok) {
          const data = await coursesRes.json();
          setApiCourses(data);
        }
        if (catsRes.ok) {
          const data = await catsRes.json();
          setCategories(data.items || []);
        }
      } catch (err) {
        console.error("Failed to fetch courses or categories");
      }
    };
    const fetchCountryFees = async () => {
      try {
        const res = await apiFetch("/api/public/country-fees");
        if (res.ok) {
          const data = await res.json();
          if (data.rules && Array.isArray(data.rules) && data.rules.length > 0) {
            setCountryFeeRules(data.rules);
            const inRule = data.rules.find((r: CountryFeeRule) => r.country_code === "IN") || data.rules[0];
            setSelectedCountryFee(inRule);
          }
        }
      } catch (err) {
        console.error("Failed to fetch country fee rules");
      }
    };
    fetchCenters();
    fetchCourses();
    fetchCountryFees();
  }, []);

  useEffect(() => {
    if (formData.center) {
      const fetchBatches = async () => {
        try {
          const res = await apiFetch(`/api/public/batches?center_id=${formData.center}`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              setCenterBatches(data);
              return;
            }
          }
        } catch (err) {
          console.error("Failed to fetch batches");
        }
        // Fallback default batches for centers
        setCenterBatches([
          { id: "batch_morning", name: "Regular Morning Batch", time_slot: "09:00 AM - 11:00 AM", max_capacity: 30, current_count: 12 },
          { id: "batch_afternoon", name: "Regular Afternoon Batch", time_slot: "01:00 PM - 03:00 PM", max_capacity: 30, current_count: 18 },
          { id: "batch_evening", name: "Evening Professional Batch", time_slot: "05:00 PM - 07:00 PM", max_capacity: 25, current_count: 10 },
          { id: "batch_weekend", name: "Weekend Fast-Track Batch", time_slot: "Sat & Sun 10:00 AM - 02:00 PM", max_capacity: 20, current_count: 7 },
        ]);
      };
      fetchBatches();
    }
  }, [formData.center, formData.courseId]);

  const coursesByCategory = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    apiCourses.forEach(course => {
      const catId = course.category_id || "other";
      if (!grouped[catId]) grouped[catId] = [];
      grouped[catId].push(course);
    });
    return grouped;
  }, [apiCourses]);

  const getCategoryName = (id: string) => {
    if (id === "other") return t("Other Programs");
    const cat = categories.find(c => (c.id === id || c._id === id));
    return cat ? t(cat.name) : t("Other Programs");
  };

  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const sendOTP = async () => {
    if (!formData.email) {
      toast.error(t("Please enter an email address to receive OTP"));
      return;
    }

    setVerifyingOtp(true);
    try {
      const res = await apiFetch("/api/auth/send-email-otp", {
        method: "POST",
        body: JSON.stringify({ email: formData.email })
      });
      if (res.ok) {
        setOtpSent(true);
        toast.success(t("OTP sent to {{email}}", { email: formData.email }));
      } else {
        toast.error(t("Failed to send OTP"));
      }
    } catch (err) {
      toast.error(t("Error sending OTP"));
    } finally {
      setVerifyingOtp(false);
    }
  };

  const nextStep = () => {
    if (currentStep === 2 && !otpVerified) {
      toast.error(t("Please verify your email address before continuing"));
      return;
    }

    if (currentStep === 4 && !formData.center) {
      toast.error(t("Please select a training center before continuing"));
      return;
    }

    setCurrentStep((prev) => Math.min(prev + 1, 5));
  };
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const handleCourseSelect = (slug: string, id: string, fee: number) => {
    setFormData({ ...formData, course: slug, courseId: id, registrationFee: fee });
    nextStep();
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const verifyOTP = async (otp: string) => {
    setVerifyingOtp(true);
    try {
      const res = await apiFetch("/api/auth/verify-email-otp", {
        method: "POST",
        body: JSON.stringify({ email: formData.email, otp })
      });
      if (res.ok) {
        setOtpVerified(true);
        toast.success(t("Email verified successfully"));
      } else {
        toast.error(t("Invalid or expired OTP"));
      }
    } catch (err) {
      toast.error(t("Error verifying OTP"));
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handlePayment = async () => {
    if (!otpVerified) {
      toast.error(t("Please verify your email address first"));
      setCurrentStep(2);
      return;
    }

    if (!formData.center) {
      toast.error(t("Please select a training center"));
      setCurrentStep(4);
      return;
    }

    if (!formData.batch) {
      toast.error(t("Please select a batch"));
      setCurrentStep(5);
      return;
    }

    setIsSubmitting(true);
    try {
      const studentData = {
        username: formData.mobile,
        password: "password",    // Backend will handle generation or user will reset
        fullName: formData.name,
        fatherName: formData.fatherName,
        motherName: formData.motherName,
        email: formData.email,
        phone: formData.mobile,
        course: formData.course,
        centerId: formData.center,
        batch: formData.batch,
        mode: formData.mode,
        dob: formData.dob,
        gender: formData.gender,
        category: formData.category === "Other" ? formData.otherCategory : formData.category,
        nationalIdType: formData.nationalIdType === "Other" ? formData.otherNationalIdType : formData.nationalIdType,
        nationalId: formData.nationalId,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        country: formData.country,
        pincode: formData.pincode,
        coupon_code: formData.coupon_code || undefined,
        referral_code_used: formData.referral_code.trim() || undefined,
        additionalDocs: JSON.stringify({
          qualification: formData.qualification,
          other_doc_name: formData.otherDocName,
          other_doc_url: formData.otherDocUrl,
        }),
      };

      const sdkOk = await loadRazorpayScript();
      if (!sdkOk) {
        toast.error(t("Payment SDK failed to load. Check your connection."));
        setIsSubmitting(false);
        return;
      }

      const orderRes = await apiFetch("/api/public/payments/create-order", {
        method: "POST",
        body: JSON.stringify({
          amount: formData.registrationFee,
          student_data: studentData,
        }),
      });

      if (!orderRes.ok) {
        const errData = await orderRes.json().catch(() => ({}));
        toast.error(errData.message || t("Failed to create payment order"));
        setIsSubmitting(false);
        return;
      }

      const orderData = await orderRes.json();

      const options = {
        key: orderData.key_id,
        amount: orderData.amount * 100,
        currency: "INR",
        name: t("Sir Chhotu Ram Education"),
        description: t("Registration fee for {{course}}", { course: t(formData.course) }),
        order_id: orderData.order_id,
        handler: async (response: any) => {
          try {
            const verifyRes = await apiFetch("/api/public/payments/verify", {
              method: "POST",
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            if (verifyRes.ok) {
              setIsSubmitted(true);
              toast.success(t("Registration and Payment Successful!"));
            } else {
              toast.error(t("Payment verification failed"));
            }
          } catch (err) {
            toast.error(t("Verification error"));
          }
        },
        prefill: {
          name: formData.name,
          email: formData.email,
          contact: formData.mobile,
        },
        theme: {
          color: "#004a89",
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err) {
      toast.error(t("An error occurred. Please try again later."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep < 5) {
      nextStep();
      return;
    }

    // Final step - trigger payment
    handlePayment();
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-8 text-center border-none shadow-2xl bg-card animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h2 className="text-3xl font-extrabold text-foreground mb-4">{t("Registration Successful!")}</h2>
            <p className="text-muted-foreground mb-8 text-lg">
              {t("Thank you for enrolling. Your application has been received and our center will contact you shortly to complete the process.")}
            </p>
            <Button className="w-full py-6 text-lg font-bold rounded-xl" onClick={() => window.location.href = "/"}>
              {t("Return to Home")}
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
        {/* Hero Section (Step 0) */}
        {currentStep === 0 && (
          <section className="relative py-20 md:py-32 overflow-hidden bg-gradient-to-b from-primary/5 to-background">
            <div className="container mx-auto px-4 text-center relative z-10">
              <span className="inline-block px-4 py-1.5 mb-6 text-xs font-bold tracking-widest uppercase bg-primary/10 text-primary rounded-full">
                {t("SCRE Admissions 2026")}
              </span>
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-foreground tracking-tight mb-6">
                {t("Start Your Learning")} <br className="hidden md:block" />
                <span className="text-primary">{t("Journey Today")}</span>
              </h1>
              <p className="max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed">
                {t("Unlock your potential with career-focused learning, industry-recognized certifications, and hands-on job skills training.")}
              </p>
              <Button size="lg" className="h-14 px-10 text-lg font-bold rounded-full shadow-lg shadow-primary/20 hover:scale-105 transition-transform" onClick={nextStep}>
                {t("Enroll Now")} <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
            </div>

            {/* Background elements */}
            <div className="absolute top-1/2 left-0 -translate-y-1/2 w-64 h-64 bg-primary/10 rounded-full blur-3xl -ml-32 opacity-50"></div>
            <div className="absolute top-1/4 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -mr-48 opacity-50"></div>
          </section>
        )}

        {/* Step 1: Course Selection */}
        {currentStep === 1 && (
          <section className="py-16 container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold mb-4">{t("Select Your Course")}</h2>
                <p className="text-muted-foreground">{t("Choose the program that best fits your career goals")}</p>
              </div>

              <div className="space-y-16">
                {apiCourses.length > 0 ? (
                  Object.entries(coursesByCategory).map(([catId, catCourses]) => (
                    <div key={catId} className="space-y-8">
                      <div className="flex items-center gap-4">
                        <div className="h-px bg-border flex-grow"></div>
                        <h3 className="text-xl font-black uppercase tracking-widest text-primary whitespace-nowrap">
                          {getCategoryName(catId)}
                        </h3>
                        <div className="h-px bg-border flex-grow"></div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {catCourses.map((course) => (
                          <Card
                            key={course.id}
                            className={`cursor-pointer transition-all duration-300 hover:shadow-xl hover:border-primary/50 group flex flex-col ${formData.course === course.course_name ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : ''}`}
                            onClick={() => handleCourseSelect(course.course_name, course.id, course.registration_fee || 0)}
                          >
                            <CardContent className="p-6 flex flex-col h-full">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${formData.course === course.course_name ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'}`}>
                                <BookOpen className="w-6 h-6" />
                              </div>
                              <h3 className="text-xl font-bold mb-2">{t(course.course_name)}</h3>
                              <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{stripHtml(t(course.description))}</p>

                              <div className="mt-auto pt-4 border-t border-border/50 space-y-2">
                                <div className="flex justify-between items-center">
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t("Registration Fee")}</span>
                                    <span className="text-lg font-black text-primary">₹{course.registration_fee || 0}</span>
                                  </div>
                                  <div className="flex items-center text-xs font-black text-primary uppercase tracking-wider group-hover:translate-x-1 transition-transform">
                                    {t("Select")} <ChevronRight className="ml-1 w-4 h-4" />
                                  </div>
                                </div>
                                <div className="pt-2 border-t border-border/30 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSyllabusModalCourse(course);
                                      setSyllabusModalOpen(true);
                                    }}
                                    className="text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                                  >
                                    <Sparkles className="w-3 h-3 text-primary" /> {t("Syllabus Coverage")}
                                  </button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {courses.map((course) => (
                      <Card
                        key={course.slug}
                        className={`cursor-pointer transition-all duration-300 hover:shadow-xl hover:border-primary/50 group ${formData.course === course.slug ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : ''}`}
                        onClick={() => handleCourseSelect(course.slug, course.slug, 0)}
                      >
                        <CardContent className="p-6">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${formData.course === course.slug ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'}`}>
                            <BookOpen className="w-6 h-6" />
                          </div>
                          <h3 className="text-xl font-bold mb-2">{t(course.title)}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{t(course.desc)}</p>
                          <div className="flex items-center text-xs font-bold text-primary uppercase tracking-wider">
                            {t("Select Course")} <ChevronRight className="ml-1 w-4 h-4" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Registration Form Steps */}
        {currentStep > 1 && (
          <section className="py-16 container mx-auto px-4">
            <div className="max-w-2xl mx-auto">
              {/* Progress Tracker */}
              <div className="mb-12">
                <div className="flex justify-between items-center mb-4">
                  {steps.map((step) => (
                    <div key={step.id} className="flex flex-col items-center gap-2">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${currentStep - 1 >= step.id ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-muted text-muted-foreground'}`}>
                        {currentStep - 1 > step.id ? <CheckCircle2 className="w-5 h-5" /> : step.icon}
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${currentStep - 1 >= step.id ? 'text-primary' : 'text-muted-foreground'}`}>
                        {step.title}
                      </span>
                    </div>
                  ))}
                </div>
                <Progress value={((currentStep - 1) / steps.length) * 100} className="h-1.5" />
              </div>

              <Card className="border-none shadow-2xl shadow-primary/5 bg-card overflow-hidden">
                <CardContent className="p-8 md:p-10">
                  <form onSubmit={handleSubmit} className="space-y-8">

                    {/* Step 1: Personal Info */}
                    {currentStep === 2 && (
                      <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                        <div className="space-y-2">
                          <h3 className="text-2xl font-bold">{t("Personal Information")}</h3>
                          <p className="text-muted-foreground text-sm">{t("Let's start with your basic details")}</p>
                        </div>

                        {/* Single Student Multi-Course Helper */}
                        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wide">
                              <Sparkles className="w-3.5 h-3.5" />
                              {t("Single Login Multi-Course Admission")}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {t("Already an enrolled student? Auto-fill your details to add this course under your existing account.")}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowExistingStudentModal(true)}
                            className="rounded-xl border-primary/40 text-primary hover:bg-primary hover:text-white font-bold text-xs shrink-0"
                          >
                            <Search className="w-3.5 h-3.5 mr-1.5" />
                            {t("Auto-Fill Profile")}
                          </Button>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="name">{t("Full Name")}</Label>
                            <Input
                              id="name"
                              placeholder={t("Enter your full name")}
                              className="h-12 rounded-lg"
                              value={formData.name}
                              onChange={(e) => handleInputChange('name', e.target.value)}
                              required
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="fatherName">{t("Father's Name")}</Label>
                              <Input
                                id="fatherName"
                                placeholder={t("Enter father's name")}
                                className="h-12 rounded-lg"
                                value={formData.fatherName}
                                onChange={(e) => handleInputChange('fatherName', e.target.value)}
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="motherName">{t("Mother's Name")}</Label>
                              <Input
                                id="motherName"
                                placeholder={t("Enter mother's name")}
                                className="h-12 rounded-lg"
                                value={formData.motherName}
                                onChange={(e) => handleInputChange('motherName', e.target.value)}
                                required
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="email">{t("Email Address")}</Label>
                            <div className="flex gap-2">
                              <Input
                                id="email"
                                type="email"
                                placeholder="email@example.com"
                                className="h-12 rounded-lg"
                                value={formData.email}
                                onChange={(e) => handleInputChange('email', e.target.value)}
                                disabled={otpVerified}
                                required
                              />
                              {!otpVerified && (
                                <Button type="button" variant="outline" className="h-12 px-4" onClick={sendOTP} disabled={verifyingOtp}>
                                  {otpSent ? t("Resend") : t("Verify Email")}
                                </Button>
                              )}
                              {otpVerified && (
                                <div className="h-12 px-4 flex items-center gap-2 text-green-600 font-bold">
                                  <CheckCircle2 className="w-5 h-5" /> {t("Verified")}
                                </div>
                              )}
                            </div>
                          </div>

                          {otpSent && !otpVerified && (
                            <div className="space-y-3 p-4 bg-muted/50 rounded-xl border border-border animate-in fade-in duration-300">
                              <Label className="text-xs font-bold uppercase tracking-wider">{t("Enter OTP")}</Label>
                              <InputOTP maxLength={6} value={formData.otp} onChange={(val) => {
                                handleInputChange('otp', val);
                                if (val.length === 6) verifyOTP(val);
                              }}>
                                <InputOTPGroup>
                                  <InputOTPSlot index={0} />
                                  <InputOTPSlot index={1} />
                                  <InputOTPSlot index={2} />
                                  <InputOTPSlot index={3} />
                                  <InputOTPSlot index={4} />
                                  <InputOTPSlot index={5} />
                                </InputOTPGroup>
                              </InputOTP>
                              <p className="text-[10px] text-muted-foreground">{t("Verification code sent to your email")}</p>
                            </div>
                          )}

                          <div className="space-y-2">
                            <Label htmlFor="mobile">{t("Mobile Number")}</Label>
                            <Input
                              id="mobile"
                              placeholder={t("10-digit mobile number")}
                              className="h-12 rounded-lg"
                              value={formData.mobile}
                              onChange={(e) => handleInputChange('mobile', e.target.value)}
                              maxLength={10}
                              required
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Step 2: Contact Details */}
                    {currentStep === 3 && (
                      <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                        <div className="space-y-2">
                          <h3 className="text-2xl font-bold">{t("Contact Details")}</h3>
                          <p className="text-muted-foreground text-sm">{t("Where can we reach you?")}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="dob">{t("Date of Birth")}</Label>
                            <Input
                              id="dob"
                              type="date"
                              className="h-12 rounded-lg"
                              value={formData.dob}
                              onChange={(e) => handleInputChange('dob', e.target.value)}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="gender">{t("Gender")}</Label>
                            <Select value={formData.gender} onValueChange={(val) => handleInputChange('gender', val)}>
                              <SelectTrigger className="h-12 rounded-lg">
                                <SelectValue placeholder={t("Select gender")} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="male">{t("Male")}</SelectItem>
                                <SelectItem value="female">{t("Female")}</SelectItem>
                                <SelectItem value="other">{t("Other")}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="category">{t("Category (Caste)")}</Label>
                            <Select value={formData.category} onValueChange={(val) => handleInputChange('category', val)}>
                              <SelectTrigger className="h-12 rounded-lg">
                                <SelectValue placeholder={t("Select category")} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="General">{t("General")}</SelectItem>
                                <SelectItem value="OBC">{t("OBC")}</SelectItem>
                                <SelectItem value="SC">{t("SC")}</SelectItem>
                                <SelectItem value="ST">{t("ST")}</SelectItem>
                                <SelectItem value="Other">{t("Other")}</SelectItem>
                              </SelectContent>
                            </Select>
                            {formData.category === "Other" && (
                              <Input
                                placeholder={t("Specify Category")}
                                className="h-10 mt-2"
                                value={formData.otherCategory}
                                onChange={(e) => handleInputChange('otherCategory', e.target.value)}
                                required
                              />
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="nationalIdType">{t("Government ID Type")}</Label>
                            <Select value={formData.nationalIdType} onValueChange={(val) => handleInputChange('nationalIdType', val)}>
                              <SelectTrigger className="h-12 rounded-lg">
                                <SelectValue placeholder={t("Select ID Type")} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Passport">{t("Passport")}</SelectItem>
                                <SelectItem value="Aadhaar Card">{t("Aadhaar Card")}</SelectItem>
                                <SelectItem value="Government ID Card">{t("Government ID Card")}</SelectItem>
                                <SelectItem value="Driving License">{t("Driving License")}</SelectItem>
                                <SelectItem value="PAN Card">{t("PAN Card")}</SelectItem>
                                <SelectItem value="Voter ID">{t("Voter ID")}</SelectItem>
                                <SelectItem value="Other">{t("Other")}</SelectItem>
                              </SelectContent>
                            </Select>
                            {formData.nationalIdType === "Other" && (
                              <Input
                                placeholder={t("Specify ID Type")}
                                className="h-10 mt-2"
                                value={formData.otherNationalIdType}
                                onChange={(e) => handleInputChange('otherNationalIdType', e.target.value)}
                                required
                              />
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="nationalId">{t("Government ID Number")}</Label>
                          <Input
                            id="nationalId"
                            placeholder={t("Enter your ID number")}
                            className="h-12 rounded-lg"
                            value={formData.nationalId}
                            onChange={(e) => handleInputChange('nationalId', e.target.value)}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="address">{t("Full Address")}</Label>
                          <Input
                            id="address"
                            placeholder={t("Country, State, City, Street / Locality, Area")}
                            className="h-12 rounded-lg"
                            value={formData.address}
                            onChange={(e) => handleInputChange('address', e.target.value)}
                            required
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="city">{t("City")}</Label>
                            <div className="relative">
                              <Input
                                id="city"
                                placeholder={t("Enter your city")}
                                className="h-12 rounded-lg pl-10"
                                value={formData.city}
                                onChange={(e) => handleInputChange('city', e.target.value)}
                                required
                              />
                              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="state">{t("State")}</Label>
                            <Input
                              id="state"
                              placeholder={t("Enter your state")}
                              className="h-12 rounded-lg"
                              value={formData.state}
                              onChange={(e) => handleInputChange('state', e.target.value)}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="country">{t("Country")}</Label>
                            <Input
                              id="country"
                              placeholder={t("Enter your country")}
                              className="h-12 rounded-lg"
                              value={formData.country}
                              onChange={(e) => handleInputChange('country', e.target.value)}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="pincode">{t("Postal Code")}</Label>
                            <Input
                              id="pincode"
                              placeholder={t("Postal / ZIP code")}
                              className="h-12 rounded-lg"
                              value={formData.pincode}
                              onChange={(e) => handleInputChange('pincode', e.target.value)}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="otherAddress">{t("Other Address Details")}</Label>
                            <Input
                              id="otherAddress"
                              placeholder={t("Any other details")}
                              className="h-12 rounded-lg"
                              value={formData.otherAddress}
                              onChange={(e) => handleInputChange('otherAddress', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Step 3: Education & Center & Batch */}
                    {currentStep === 4 && (
                      <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                        <div className="space-y-2">
                          <h3 className="text-2xl font-bold">{t("Academic & Center")}</h3>
                          <p className="text-muted-foreground text-sm">{t("Select your center and available batch")}</p>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="qualification">{t("Highest Qualification")}</Label>
                            <Select value={formData.qualification} onValueChange={(val) => handleInputChange('qualification', val)}>
                              <SelectTrigger className="h-12 rounded-lg">
                                <SelectValue placeholder={t("Select qualification")} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="10th">{t("10th Pass")}</SelectItem>
                                <SelectItem value="12th">{t("12th Pass")}</SelectItem>
                                <SelectItem value="undergrad">{t("Undergraduate")}</SelectItem>
                                <SelectItem value="grad">{t("Graduate")}</SelectItem>
                                <SelectItem value="postgrad">{t("Post Graduate")}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="center">{t("Training Center")}</Label>
                            <Select value={formData.center} onValueChange={(val) => {
                              handleInputChange('center', val);
                              handleInputChange('batch', ''); // Reset batch on center change
                            }}>
                              <SelectTrigger className="h-12 rounded-lg">
                                <SelectValue placeholder={t("Choose nearest center")} />
                              </SelectTrigger>
                              <SelectContent>
                                {centers.map(center => (
                                  <SelectItem key={center.id} value={center.id}>{t(center.name)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {formData.center && (
                            <div className="space-y-3 animate-in fade-in duration-500">
                              <div className="flex items-center justify-between">
                                <Label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-foreground">
                                  <Clock className="w-4 h-4 text-primary" />
                                  {t("Available Batches for This Program")}
                                </Label>
                                {formData.course && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const found = apiCourses.find((c) => c.id === formData.courseId || c.course_name === formData.course);
                                      setSyllabusModalCourse(found || { course_name: formData.course });
                                      setSyllabusModalOpen(true);
                                    }}
                                    className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline flex items-center gap-1"
                                  >
                                    <Sparkles className="w-3 h-3" /> {t("Syllabus Coverage")}
                                  </button>
                                )}
                              </div>

                              {centerBatches.length > 0 ? (
                                <RadioGroup value={formData.batch} onValueChange={(val) => handleInputChange('batch', val)} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {centerBatches.map((batch) => {
                                    const batchId = batch._id || batch.id;
                                    const availableSeats = Math.max(0, (batch.max_capacity || 30) - (batch.current_count || 0));
                                    const isFull = availableSeats <= 0;
                                    const isSelected = formData.batch === batchId;

                                    return (
                                      <div
                                        key={batchId}
                                        onClick={() => !isFull && handleInputChange('batch', batchId)}
                                        className={`flex items-start space-x-3 border p-4 transition-all rounded-none cursor-pointer ${
                                          isFull
                                            ? 'opacity-50 bg-muted/60 cursor-not-allowed border-dashed'
                                            : isSelected
                                            ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                                            : 'hover:border-primary/50 hover:bg-primary/5'
                                        }`}
                                      >
                                        <RadioGroupItem value={batchId} id={batchId} disabled={isFull} className="mt-1" />
                                        <Label htmlFor={batchId} className="flex flex-col cursor-pointer w-full">
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="font-bold text-sm text-foreground">{t(batch.name || batch.batch_name)}</span>
                                            <Badge
                                              variant="outline"
                                              className={`text-[9px] font-black px-1.5 py-0.5 rounded-none uppercase tracking-wider ${
                                                isFull
                                                  ? 'bg-red-500/10 text-red-600 border-red-500/20'
                                                  : availableSeats < 10
                                                  ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                                  : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                              }`}
                                            >
                                              {isFull ? t("FULL") : `${availableSeats} ${t("Seats Left")}`}
                                            </Badge>
                                          </div>
                                          <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5 mt-0.5">
                                            <Clock className="w-3 h-3 text-primary" />
                                            {batch.time_slot || `${batch.start_time || "10:00 AM"} - ${batch.end_time || "12:00 PM"}`}
                                          </div>
                                          {batch.days && Array.isArray(batch.days) && batch.days.length > 0 && (
                                            <div className="text-[10px] text-muted-foreground/80 mt-1 uppercase tracking-wider">
                                              {batch.days.join(" • ")}
                                            </div>
                                          )}
                                        </Label>
                                      </div>
                                    );
                                  })}
                                </RadioGroup>
                              ) : (
                                <div className="p-6 border-2 border-dashed rounded-none text-center bg-muted/20">
                                  <p className="text-sm text-muted-foreground">{t("No active batches found for this center.")}</p>
                                </div>
                              )}

                              {centerBatches.length > 0 && centerBatches.every(b => (b.current_count || 0) >= (b.max_capacity || 0)) && (
                                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center">
                                  <p className="text-sm text-red-600 font-bold mb-2">
                                    {t("All batches in this center are full.")}
                                  </p>
                                  <p className="text-xs text-red-500">
                                    {t("Please select another center from the list above.")}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Step 4: Preferences & Payment */}
                    {currentStep === 5 && (
                      <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                        <div className="space-y-2">
                          <h3 className="text-2xl font-bold">{t("Payment & Confirmation")}</h3>
                          <p className="text-muted-foreground text-sm">{t("Review your details and complete registration")}</p>
                        </div>

                        <div className="space-y-6">
                          <div className="space-y-3">
                            <Label>{t("Learning Mode")}</Label>
                            <RadioGroup value={formData.mode} onValueChange={(val) => handleInputChange('mode', val)} className="grid grid-cols-2 gap-4">
                              <div className="flex items-center space-x-2 border rounded-xl p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                                <RadioGroupItem value="offline" id="offline" />
                                <Label htmlFor="offline" className="flex items-center gap-2 cursor-pointer w-full font-bold">
                                  <Monitor className="w-4 h-4 text-primary" /> {t("Offline")}
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2 border rounded-xl p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                                <RadioGroupItem value="online" id="online" />
                                <Label htmlFor="online" className="flex items-center gap-2 cursor-pointer w-full font-bold">
                                  <Monitor className="w-4 h-4 text-primary" /> {t("Online")}
                                </Label>
                              </div>
                            </RadioGroup>
                          </div>

                          <div className="space-y-3 p-6 bg-accent/5 border border-accent/20 rounded-2xl">
                            <Label className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
                              {t("Do you have any coupon / discount code?")}
                            </Label>
                            <div className="flex gap-2">
                              <Input
                                type="text"
                                value={formData.coupon_code}
                                onChange={(e) => handleInputChange('coupon_code', e.target.value.toUpperCase())}
                                className="h-12 bg-background border-accent/20 font-bold uppercase"
                                placeholder="e.g. SAVE50"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => validateCoupon(formData.coupon_code)}
                                className="h-12 px-6 border-accent/20 font-bold"
                              >
                                {t("Apply")}
                              </Button>
                            </div>
                            {couponInfo && (
                              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-2">
                                {t("Coupon Applied")}: {couponInfo.discount_value}{couponInfo.discount_type === 'percentage' ? '%' : ''} {t("Discount")}
                              </p>
                            )}
                          </div>

                          {/* Referral Code Box */}
                          <div className="space-y-3 p-6 bg-muted/40 border border-border rounded-none">
                            <Label className="text-xs font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                              <Gift className="w-4 h-4 text-primary" />
                              {t("Referral Code (Student / Center / Staff)")}
                              <span className="text-[10px] text-muted-foreground font-normal">({t("Optional")})</span>
                            </Label>
                            <div className="flex gap-2">
                              <Input
                                type="text"
                                value={formData.referral_code}
                                onChange={(e) => {
                                  handleInputChange('referral_code', e.target.value.toUpperCase());
                                  setReferralValidated(null);
                                }}
                                className="h-12 bg-background border-border font-bold uppercase rounded-none"
                                placeholder="e.g. STU-1A2B3C, CEN-101, or STF-201"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                disabled={validatingReferral || !formData.referral_code.trim()}
                                onClick={() => validateReferral(formData.referral_code)}
                                className="h-12 px-6 border-border font-bold rounded-none shrink-0"
                              >
                                {validatingReferral ? <Loader2 className="w-4 h-4 animate-spin" /> : t("Verify")}
                              </Button>
                            </div>

                            {referralValidated?.valid && (
                              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 rounded-none flex items-center gap-2 text-xs font-bold animate-in fade-in">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>
                                  {t("Verified Referrer")}: <span className="underline">{referralValidated.user_name}</span> ({referralValidated.user_role || t("Partner")})
                                </span>
                              </div>
                            )}

                            {referralValidated && !referralValidated.valid && (
                              <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">
                                {referralValidated.message || t("Invalid referral code")}
                              </p>
                            )}

                            <p className="text-[10px] text-muted-foreground">
                              {t("If an enrolled student, center, or staff member referred you, verify their code here.")}
                            </p>
                          </div>

                          <div className="p-6 bg-primary/5 rounded-2xl border border-primary/20 space-y-4">
                            <div className="flex flex-col gap-2">
                              <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{t("Summary")}</span>
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-muted-foreground">{t("Selected Course")}</span>
                                <span className="text-sm font-bold">{t(formData.course)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-muted-foreground">{t("Selected Center")}</span>
                                <span className="text-sm font-bold">{centers.find(c => c.id === formData.center)?.name}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-muted-foreground">{t("Batch")}</span>
                                <span className="text-sm font-bold">{formData.batch}</span>
                              </div>
                            </div>

                            {countryFeeRules.length > 1 && (
                              <div className="pt-3 border-t border-primary/10 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <Globe className="w-4 h-4 text-primary" />
                                  <span className="text-xs font-bold uppercase tracking-wider">{t("Select Currency")}</span>
                                </div>
                                <Select
                                  value={selectedCountryFee.country_code}
                                  onValueChange={(code) => {
                                    const rule = countryFeeRules.find(r => r.country_code === code);
                                    if (rule) setSelectedCountryFee(rule);
                                  }}
                                >
                                  <SelectTrigger className="w-[180px] h-9 text-xs font-bold bg-background rounded-lg">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {countryFeeRules.map(rule => (
                                      <SelectItem key={rule.country_code} value={rule.country_code} className="text-xs font-bold">
                                        {rule.country_name} ({rule.currency_symbol} {rule.currency_code})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            <div className="pt-4 border-t border-primary/10">
                              <div className="flex justify-between items-center">
                                <div className="flex flex-col">
                                  <span className="text-base font-black uppercase tracking-tight">{t("Registration Fee")}</span>
                                  <span className="text-[10px] text-muted-foreground">{t("Non-refundable admission processing fee")}</span>
                                  {selectedCountryFee.country_code !== "IN" && (
                                    <span className="text-[10px] text-muted-foreground font-semibold">
                                      {t("Base fee")}: ₹{formData.registrationFee.toLocaleString()} INR
                                    </span>
                                  )}
                                </div>
                                <div className="text-right">
                                  <span className="text-2xl font-black text-primary">
                                    {selectedCountryFee.currency_symbol}{Math.round(formData.registrationFee * selectedCountryFee.multiplier).toLocaleString()}
                                  </span>
                                  <span className="block text-[10px] font-bold text-muted-foreground uppercase">
                                    {selectedCountryFee.currency_code}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <Label className="flex items-center gap-2">
                              <Upload className="w-4 h-4 text-primary" />
                              {t("Upload Documents (Optional)")}
                            </Label>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="border-2 border-dashed border-muted rounded-xl p-6 text-center hover:border-primary/50 transition-all group cursor-pointer bg-muted/10">
                                <Upload className="mx-auto w-6 h-6 text-muted-foreground mb-2 group-hover:text-primary transition-colors" />
                                <span className="text-xs font-bold block">{t("Photo")}</span>
                              </div>
                              <div className="border-2 border-dashed border-muted rounded-xl p-6 text-center hover:border-primary/50 transition-all group cursor-pointer bg-muted/10">
                                <Upload className="mx-auto w-6 h-6 text-muted-foreground mb-2 group-hover:text-primary transition-colors" />
                                <span className="text-xs font-bold block">{t("ID Proof")}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="flex gap-4 pt-4">
                      {currentStep > 1 && (
                        <Button type="button" variant="outline" className="h-12 px-6 font-bold" onClick={prevStep}>
                          <ChevronLeft className="mr-2 w-4 h-4" /> {t("Back")}
                        </Button>
                      )}

                      {currentStep < 5 ? (
                        <Button type="button" className="h-12 flex-grow font-bold rounded-lg" onClick={nextStep}>
                          {t("Continue")} <ChevronRight className="ml-2 w-4 h-4" />
                        </Button>
                      ) : (
                        <Button type="submit" disabled={isSubmitting} className="h-12 flex-grow font-bold rounded-lg shadow-lg shadow-primary/20">
                          {isSubmitting ? t("Processing...") : t("Complete Registration")} <CheckCircle2 className="ml-2 w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Trust Indicators */}
              <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
                <div className="text-center p-4 rounded-2xl bg-muted/30">
                  <div className="text-2xl font-black text-primary mb-1">10k+</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t("Students")}</div>
                </div>
                <div className="text-center p-4 rounded-2xl bg-muted/30">
                  <div className="text-2xl font-black text-primary mb-1">98%</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t("Placement")}</div>
                </div>
                <div className="text-center p-4 rounded-2xl bg-muted/30">
                  <div className="text-2xl font-black text-primary mb-1">ISO</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t("Certified")}</div>
                </div>
                <div className="text-center p-4 rounded-2xl bg-muted/30">
                  <div className="text-2xl font-black text-primary mb-1">Govt.</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t("Recognized")}</div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Global Trust Section (at bottom of hero/course selection) */}
        {currentStep <= 1 && (
          <section className="py-20 bg-muted/20">
            <div className="container mx-auto px-4">
              <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-background rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                    <ShieldCheck className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{t("Verified Training")}</h3>
                  <p className="text-sm text-muted-foreground">{t("ISO certified curriculum and industry-standard training modules.")}</p>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-background rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                    <Users className="w-8 h-8 text-secondary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{t("Expert Mentors")}</h3>
                  <p className="text-sm text-muted-foreground">{t("Learn from professionals with years of real-world experience.")}</p>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-background rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                    <Award className="w-8 h-8 text-accent" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{t("Career Support")}</h3>
                  <p className="text-sm text-muted-foreground">{t("100% placement assistance and interview preparation.")}</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Existing Student Lookup Dialog */}
        <Dialog open={showExistingStudentModal} onOpenChange={setShowExistingStudentModal}>
          <DialogContent className="rounded-3xl max-w-md p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                <Sparkles className="w-5 h-5 text-primary" />
                {t("Existing Student Lookup")}
              </DialogTitle>
              <DialogDescription>
                {t("Enter your Enrollment Number, Roll Number, or Username to auto-populate your details.")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t("Enrollment / Roll Number / Username")}
                </Label>
                <div className="relative">
                  <Input
                    placeholder="e.g. SCRE/2026/001"
                    value={lookupQuery}
                    onChange={(e) => setLookupQuery(e.target.value)}
                    className="rounded-2xl h-12 uppercase font-semibold text-sm pl-4 pr-10"
                  />
                  <QrCode className="w-5 h-5 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none" />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setShowExistingStudentModal(false)}
                className="rounded-xl text-xs font-bold"
              >
                {t("Cancel")}
              </Button>
              <Button
                onClick={handleLookupExistingStudent}
                disabled={lookingUp || !lookupQuery.trim()}
                className="rounded-xl text-xs font-bold gap-2"
              >
                {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {t("Find & Auto-Fill")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Syllabus Coverage Breakdown Modal */}
        <SyllabusCoverageModal
          isOpen={syllabusModalOpen}
          onClose={() => setSyllabusModalOpen(false)}
          course={syllabusModalCourse}
        />
      </main>

      <Footer />
    </div>
  );
};

export default AdmissionPage;
