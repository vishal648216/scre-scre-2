import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  User,
  BookOpen,
  MapPin,
  Shield,
  GraduationCap,
  Camera,
  Upload,
  FileText,
  Lock,
  Users,
  Send,
  Loader2,
  Trash2,
  CheckCircle2,
  Eye,
  EyeOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { formatCourseDuration } from "@/lib/courseDisplay";

function formatCourseUnitsSummary(course: Record<string, unknown> | null | undefined): string {
  if (!course || !course.has_course_structure_units) return "—";
  const ut = String(course.unit_type || "");
  if (!ut) return "—";
  const count = course.unit_count != null && course.unit_count !== "" ? String(course.unit_count) : "";
  const label =
    ut === "custom" && course.custom_unit_name
      ? String(course.custom_unit_name)
      : ut === "quarterly"
        ? "Quarterly"
        : ut === "semesters"
          ? "Semesters"
          : ut === "yearly"
            ? "Yearly"
            : ut;
  if (count) return `${count} × ${label}`;
  return label;
}

const ADD_STUDENT_INITIAL = {
  username: "",
  password: "",
  fullName: "",
  firstName: "",
  middleName: "",
  lastName: "",
  email: "",
  phone: "",
  course: "",
  courseId: "",
  session_id: "",
  admissionMode: "",
  exam_mode: "",
  batch_id: "",
  fatherName: "",
  motherName: "",
  dob: "",
  gender: "",
  otherGender: "",
  category: "",
  otherCategory: "",
  nationalIdType: "",
  otherNationalIdType: "",
  nationalId: "",
  address: "",
  city: "",
  state: "",
  district: "",
  country: "",
  pincode: "",
  otherAddress: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactRelation: "",
  highestQualification: "",
  otherHighestQualification: "",
  additionalDocs: "",
  tenthDmcUrl: "",
  nationalIdImageUrl: "",
  nationalIdUrl: "",
  signatureUrl: "",
  otherDocName: "",
  otherDocUrl: "",
  enrollmentNumber: "",
  rollNumber: "",
  registrationDate: "",
  photoUrl: "",
  sessionStartDate: "",
  sessionEndDate: "",
  courseCategory: "",
  autoGenerateEnrollment: true,
  autoGenerateRoll: true,
  referral_code_used: "",
  coupon_code: "",
  additionalDocuments: [] as { name: string; number: string; url: string }[],
  currentUnit: "",
  customUnits: [] as string[],
};

const AddStudentPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Form, 2: Preview
  const [centerLoading, setCenterLoading] = useState(true);
  const [allottedCourses, setAllottedCourses] = useState<string[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [submittedStudent, setSubmittedStudent] = useState<any>(null);
  const [passwordFieldName, setPasswordFieldName] = useState(`pwd_${Math.random().toString(36).substring(7)}`);

  const [formData, setFormData] = useState(() => ({ ...ADD_STUDENT_INITIAL }));
  const [customUnitInput, setCustomUnitInput] = useState("");

  useEffect(() => {
    try {
      localStorage.removeItem("form_draft_add_student");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    // Aggressive cleanup to ensure no browser autofill survives
    const timer = setTimeout(() => {
      setFormData((prev) => ({ ...prev, password: "" }));
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const downloadReceipt = async () => {
    if (!submittedStudent?.id && !submittedStudent?._id) return;
    const id = submittedStudent.id || submittedStudent._id;
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`/api/students/${id}/enrollment-pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `student_receipt_${id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch {
      toast.error("Failed to download PDF");
    }
  };

  const [uploading, setUploading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [centerCourses, setCenterCourses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedCourseDetails, setSelectedCourseDetails] = useState<any>(null);
  const [referralInfo, setReferralInfo] = useState<{ name: string, role: string } | null>(null);
  const [couponInfo, setCouponInfo] = useState<{ discount_type: string, discount_value: number } | null>(null);

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
        toast.success(`Coupon applied: ${data.discount_value}${data.discount_type === 'percentage' ? '%' : ''} off`);
      } else {
        const data = await res.json().catch(() => ({}));
        setCouponInfo(null);
        toast.error(data.message || "Invalid or expired coupon");
      }
    } catch {
      setCouponInfo(null);
      toast.error("Failed to validate coupon");
    }
  };

  const validateReferral = async (code: string) => {
    if (!code) {
      setReferralInfo(null);
      return;
    }
    try {
      const res = await apiFetch("/api/referrals/validate", {
        method: "POST",
        body: JSON.stringify({ code })
      });
      if (res.ok) {
        const data = await res.json();
        setReferralInfo({ name: data.user_name, role: data.user_role });
        toast.success(`Referral code valid: ${data.user_name} (${data.user_role})`);
      } else {
        setReferralInfo(null);
        toast.error("Invalid referral code");
      }
    } catch {
      setReferralInfo(null);
    }
  };

  const parsedAdditionalDocs = useMemo(() => {
    try {
      return JSON.parse(formData.additionalDocs || "{}");
    } catch {
      return {};
    }
  }, [formData.additionalDocs]);

  useEffect(() => {
    const fetchInitialData = async () => {
      setCenterLoading(true);
      try {
        const [courseRes, sessionRes, batchRes] = await Promise.all([
          apiFetch("/api/courses/allot"),
          apiFetch("/api/academic/sessions"),
          apiFetch("/api/batches"),
        ]);

        if (courseRes.ok) {
          const data = await courseRes.json();
          const list = Array.isArray(data) ? data : [];
          setCenterCourses(list);
          const uniqueCats = Array.from(new Set(list.map((c: any) => c.category).filter(Boolean)));
          setCategories(uniqueCats);
          const ref = new URLSearchParams(window.location.search).get("ref");
          if (ref) {
            setFormData((prev) => ({ ...prev, referral_code_used: ref }));
          }
        }

        if (sessionRes.ok) {
          const data = await sessionRes.json();
          setSessions(Array.isArray(data) ? data : []);
        }

        if (batchRes.ok) {
          const data = await batchRes.json();
          setBatches(Array.isArray(data) ? data.filter((b: any) => b.status === "active") : []);
        }
      } catch (error) {
        console.error("Failed to fetch enrollment data:", error);
      } finally {
        setCenterLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  const filteredCourses = useMemo(() => {
    if (!formData.courseCategory) return centerCourses;
    return centerCourses.filter(c => c.category === formData.courseCategory);
  }, [centerCourses, formData.courseCategory]);

  const courseFees = useMemo(() => {
    if (!selectedCourseDetails) return { course: 0, admission: 0, exam: 0, discount: 0, total: 0 };
    const course = selectedCourseDetails.fees || 0;
    const admission = selectedCourseDetails.registration_fee || 0;
    const exam = selectedCourseDetails.exam_fee_amount || 0;
    let total = course + admission + exam;
    let discount = 0;

    if (couponInfo) {
      if (couponInfo.discount_type === 'percentage') {
        discount += (total * couponInfo.discount_value) / 100;
      } else {
        discount += couponInfo.discount_value;
      }
    }

    if (referralInfo) {
      // Assuming a default 500 reward for referral as seen in backend logic
      discount += 500;
    }

    return {
      course,
      admission,
      exam,
      discount,
      total: Math.max(0, total - discount)
    };
  }, [selectedCourseDetails, couponInfo, referralInfo]);

  const handleCourseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cid = e.target.value;
    const course = centerCourses.find(c => c._id === cid);
    if (course) {
      setFormData(prev => ({
        ...prev,
        course: course.course_name,
        courseId: cid,
        session_id: "",
        sessionEndDate: ""
      }));
      setSelectedCourseDetails(course);
    } else {
      setFormData(prev => ({ ...prev, course: "", courseId: "", session_id: "", sessionEndDate: "" }));
      setSelectedCourseDetails(null);
    }
  };

  const handleSessionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sid = e.target.value;
    setFormData(prev => ({
      ...prev,
      session_id: sid,
      sessionEndDate: ""
    }));
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartStr = e.target.value;
    setFormData(prev => ({ ...prev, sessionStartDate: newStartStr }));
  };

  const uploadFileToServer = async (file: File): Promise<string | null> => {
    setUploading(true);
    const formDataUpload = new FormData();
    formDataUpload.append("file", file);
    try {
      const res = await apiFetch("/api/uploads", {
        method: "POST",
        body: formDataUpload,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) return data.url as string;
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadFileToServer(file);
      if (url) {
        setFormData(prev => ({ ...prev, photoUrl: url }));
        toast.success("Photo uploaded successfully");
      } else {
        toast.error("Failed to upload photo");
      }
    } catch (error) {
      toast.error("Error uploading photo");
    } finally { }
  };

  const handleDocUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    key: "tenthDmcUrl" | "nationalIdImageUrl" | "signatureUrl" | "otherDocUrl" | "nationalIdUrl",
    label: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadFileToServer(file);
      if (url) {
        setFormData(prev => ({ ...prev, [key]: url }));
        toast.success(`${label} uploaded successfully`);
      } else {
        toast.error(`Failed to upload ${label.toLowerCase()}`);
      }
    } catch {
      toast.error(`Error uploading ${label.toLowerCase()}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.course) {
      toast.error("Please select a course");
      return;
    }
    if (!formData.fatherName) {
      toast.error("Father's Name is mandatory");
      return;
    }
    if (!formData.dob) {
      toast.error("Date of Birth is mandatory");
      return;
    }
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const confirmSubmit = async () => {
    setLoading(true);
    try {
      const docsPayload = {
        tenth_dmc_url: formData.tenthDmcUrl || undefined,
        national_id_image_url: formData.nationalIdImageUrl || undefined,
        national_id_url: formData.nationalIdUrl || undefined,
        signature_url: formData.signatureUrl || undefined,
        other_docs: formData.additionalDocuments,
        emergency_contact_relation: formData.emergencyContactRelation || undefined,
        custom_units: formData.customUnits,
      };

      const payload = {
        ...formData,
        username: formData.email,
        gender: formData.gender === "Other" ? formData.otherGender : formData.gender,
        category: formData.category === "Other" ? formData.otherCategory : formData.category,
        highestQualification: formData.highestQualification === "Other" ? formData.otherHighestQualification : formData.highestQualification,
        additionalDocs: JSON.stringify(docsPayload),
        session_id: formData.session_id || undefined,
      };

      const response = await apiFetch("/api/students", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          enrollmentNumber: undefined,
          rollNumber: undefined,
          registrationDate: formData.registrationDate || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(data.message);
        setSubmittedStudent(data.student || data.data);
        setStep(3); // Success/Download View
        setFormData({ ...ADD_STUDENT_INITIAL });
        setSelectedCourseDetails(null);
      } else {
        toast.error(data.message || "Failed to enroll student");
      }
    } catch (error) {
      toast.error("An error occurred during enrollment");
    } finally {
      setLoading(false);
    }
  };

  const PreviewView = () => (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="bg-primary/5 border border-primary/20 p-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-primary">{t("Preview Student Details")}</h2>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("Please review all information before final enrollment.")}</p>
        </div>
        <div className="flex gap-3">
          <button className="px-6 py-2 border border-border text-[10px] font-black uppercase tracking-widest hover:bg-muted" onClick={() => setStep(1)}>
            {t("Edit Details")}
          </button>
          <button className="px-6 py-2 bg-primary text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90 flex items-center gap-2" onClick={confirmSubmit} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {t("Confirm & Enroll")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="rounded-none border-border shadow-sm">
          <CardHeader className="bg-muted/30 border-b border-border py-3 px-4">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest">{t("Personal Details")}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 text-[11px]">
              <span className="font-black text-muted-foreground uppercase">{t("Full Name")}:</span>
              <span className="font-bold uppercase">{formData.fullName}</span>
            </div>
            <div className="grid grid-cols-2 text-[11px]">
              <span className="font-black text-muted-foreground uppercase">{t("Father's Name")}:</span>
              <span className="font-bold uppercase">{formData.fatherName}</span>
            </div>
            <div className="grid grid-cols-2 text-[11px]">
              <span className="font-black text-muted-foreground uppercase">{t("Course")}:</span>
              <span className="font-bold uppercase">{formData.course}</span>
            </div>
            <div className="grid grid-cols-2 text-[11px]">
              <span className="font-black text-muted-foreground uppercase">{t("Course Duration")}:</span>
              <span className="font-bold uppercase">{selectedCourseDetails ? formatCourseDuration(selectedCourseDetails) : "—"}</span>
            </div>
            <div className="grid grid-cols-2 text-[11px]">
              <span className="font-black text-muted-foreground uppercase">{t("Course Units")}:</span>
              <span className="font-bold uppercase">{formatCourseUnitsSummary(selectedCourseDetails)}</span>
            </div>
            <div className="grid grid-cols-2 text-[11px]">
              <span className="font-black text-muted-foreground uppercase">{t("Admission Mode")}:</span>
              <span className="font-bold uppercase">{formData.admissionMode ? t(formData.admissionMode) : "—"}</span>
            </div>
            <div className="grid grid-cols-2 text-[11px]">
              <span className="font-black text-muted-foreground uppercase">{t("Exam Mode")}:</span>
              <span className="font-bold uppercase">{formData.exam_mode ? t(formData.exam_mode) : "—"}</span>
            </div>
            <div className="grid grid-cols-2 text-[11px]">
              <span className="font-black text-muted-foreground uppercase">{t("Phone")}:</span>
              <span className="font-bold">{formData.phone}</span>
            </div>
            <div className="grid grid-cols-2 text-[11px]">
              <span className="font-black text-muted-foreground uppercase">{t("Email")}:</span>
              <span className="font-bold">{formData.email}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-border shadow-sm">
          <CardHeader className="bg-muted/30 border-b border-border py-3 px-4">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest">{t("Identification")}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 text-[11px]">
              <span className="font-black text-muted-foreground uppercase">{t("ID Type")}:</span>
              <span className="font-bold uppercase">{formData.nationalIdType === "Other" ? formData.otherNationalIdType : formData.nationalIdType}</span>
            </div>
            <div className="grid grid-cols-2 text-[11px]">
              <span className="font-black text-muted-foreground uppercase">{t("ID Number")}:</span>
              <span className="font-bold uppercase">{formData.nationalId}</span>
            </div>
            <div className="grid grid-cols-2 text-[11px]">
              <span className="font-black text-muted-foreground uppercase">{t("Gender")}:</span>
              <span className="font-bold uppercase">{formData.gender}</span>
            </div>
            <div className="grid grid-cols-2 text-[11px]">
              <span className="font-black text-muted-foreground uppercase">{t("Category")}:</span>
              <span className="font-bold uppercase">{formData.category === "Other" ? formData.otherCategory : formData.category}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-border shadow-sm md:col-span-2">
          <CardHeader className="bg-muted/30 border-b border-border py-3 px-4">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest">{t("Location")}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-12 text-[11px]">
              <span className="col-span-2 font-black text-muted-foreground uppercase">{t("Address")}:</span>
              <span className="col-span-10 font-bold uppercase">
                {formData.country}, {formData.state}, {formData.district}, {formData.city}, {formData.address}, {formData.pincode}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-border">
        <button className="px-8 py-3 border border-border text-xs font-black uppercase tracking-widest hover:bg-muted" onClick={() => setStep(1)}>
          {t("Back to Edit")}
        </button>
        <button className="px-12 py-3 bg-primary text-white text-xs font-black uppercase tracking-widest hover:opacity-90 flex items-center gap-2" onClick={confirmSubmit} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {t("Confirm Enrollment")}
        </button>
      </div>
    </div>
  );

  const addMoreDocument = () => {
    setFormData(prev => ({
      ...prev,
      additionalDocuments: [
        ...prev.additionalDocuments,
        { name: "", number: "", url: "" }
      ]
    }));
  };

  const removeDocument = (index: number) => {
    setFormData(prev => ({
      ...prev,
      additionalDocuments: prev.additionalDocuments.filter((_, i) => i !== index)
    }));
  };

  const handleAdditionalDocChange = (index: number, field: string, value: string) => {
    const nextDocs = [...formData.additionalDocuments];
    nextDocs[index] = { ...nextDocs[index], [field]: value };
    setFormData(prev => ({ ...prev, additionalDocuments: nextDocs }));
  };

  const handleAdditionalDocUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFileToServer(file);
    if (url) {
      handleAdditionalDocChange(index, "url", url);
      toast.success("Document uploaded");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
        <div className="flex items-center justify-between border-b border-border pb-6">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight flex items-center gap-3">
              <GraduationCap className="w-8 h-8 text-primary" />
              {step === 1 ? t("Enroll New Student") : t("Confirm Student Details")}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium uppercase tracking-wider">
              {step === 1
                ? t("Comprehensive student registration for certificates and system access.")
                : t("Review the information below and confirm to enroll the student.")}
            </p>
          </div>
        </div>

        {step === 1 ? (
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="flex flex-col gap-8">
              {/* Section 1: Course & Selection */}
              <Card className="rounded-none border-border shadow-md overflow-hidden border-t-4 border-t-emerald-600">
                <CardHeader className="bg-muted/30 border-b border-border py-4">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-emerald-700 flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    {t("Course & Selection")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Select Category")} *</label>
                      <select
                        name="courseCategory"
                        required
                        className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all"
                        value={formData.courseCategory}
                        onChange={handleChange}
                      >
                        <option value="">{t("Select Category")}</option>
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>{t(cat)}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Select Course")} *</label>
                      <select
                        name="courseId"
                        required
                        className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all"
                        value={formData.courseId}
                        onChange={handleCourseChange}
                      >
                        <option value="">{t("Select Course")}</option>
                        {(filteredCourses || []).map((c) => <option key={c._id} value={c._id}>{t(c.course_name)}</option>)}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Select Session")} *</label>
                      <select
                        name="session_id"
                        required
                        className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all"
                        value={formData.session_id}
                        onChange={handleSessionChange}
                      >
                        <option value="">{t("Select Session")}</option>
                        {(sessions || [])
                          .filter(s => s.course_id === formData.courseId)
                          .map((s) => <option key={s.id} value={s.id}>{s.session_name}</option>)}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Enrollment Date")}</label>
                      <input
                        name="registrationDate"
                        type="date"
                        className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all"
                        value={formData.registrationDate}
                        onChange={handleChange}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Course Start Date")}</label>
                      <input
                        name="sessionStartDate"
                        type="date"
                        className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all"
                        value={formData.sessionStartDate}
                        onChange={handleStartDateChange}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Course End Date")}</label>
                      <input
                        name="sessionEndDate"
                        type="date"
                        className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all"
                        value={formData.sessionEndDate}
                        onChange={handleChange}
                      />
                    </div>

                    {selectedCourseDetails && (selectedCourseDetails.has_course_structure_units || (selectedCourseDetails.unit_count && selectedCourseDetails.unit_count > 0)) && (
                      <div className="space-y-2 md:col-span-3">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Current Unit")}</label>
                        <select
                          name="currentUnit"
                          className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all"
                          value={formData.currentUnit}
                          onChange={(e) => {
                            handleChange(e);
                          }}
                        >
                          <option value="">{t("Select Unit")}</option>
                          {(() => {
                            const options: JSX.Element[] = [];
                            if (selectedCourseDetails) {
                              const ut = String(selectedCourseDetails.unit_type || "");
                              const unitCount = selectedCourseDetails.unit_count || 0;
                              let unitLabel = "";
                              if (ut === "custom" && selectedCourseDetails.custom_unit_name) {
                                unitLabel = String(selectedCourseDetails.custom_unit_name);
                              } else if (ut === "quarterly") {
                                unitLabel = "Quarter";
                              } else if (ut === "semesters") {
                                unitLabel = "Semester";
                              } else if (ut === "yearly") {
                                unitLabel = "Year";
                              } else {
                                unitLabel = ut;
                              }

                              for (let i = 1; i <= unitCount; i++) {
                                options.push(
                                  <option key={`unit-${i}`} value={`${i} ${unitLabel}${i > 1 ? "s" : ""}`}>
                                    {i} {unitLabel}{i > 1 ? "s" : ""}
                                  </option>
                                );
                              }
                            }

                            formData.customUnits.forEach((unit, i) => {
                              options.push(
                                <option key={`custom-${i}`} value={unit}>
                                  {unit}
                                </option>
                              );
                            });

                            options.push(<option key="custom-option" value="custom">Custom</option>);

                            return options;
                          })()}
                        </select>

                        {formData.currentUnit === "custom" && (
                          <div className="mt-3 space-y-3">
                            <div className="flex border border-border rounded-none overflow-hidden focus-within:border-primary">
                              <input
                                type="text"
                                placeholder={t("Add custom unit")}
                                className="flex-1 px-4 py-3 border-none bg-background text-sm font-bold focus:outline-none"
                                value={customUnitInput}
                                onChange={(e) => setCustomUnitInput(e.target.value)}
                              />
                              <button
                                type="button"
                                className="px-6 py-3 bg-primary text-white text-xs font-black uppercase tracking-widest hover:opacity-90"
                                onClick={() => {
                                  if (customUnitInput.trim() && !formData.customUnits.includes(customUnitInput.trim())) {
                                    setFormData(prev => ({
                                      ...prev,
                                      customUnits: [...prev.customUnits, customUnitInput.trim()],
                                      currentUnit: customUnitInput.trim()
                                    }));
                                    setCustomUnitInput("");
                                  }
                                }}
                              >
                                {t("Add")}
                              </button>
                            </div>

                            {formData.customUnits.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {formData.customUnits.map((unit, i) => (
                                  <div
                                    key={`custom-unit-${i}`}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border border-border rounded text-xs font-bold"
                                  >
                                    {unit}
                                    <button
                                      type="button"
                                      className="text-destructive hover:text-destructive/80"
                                      onClick={() => {
                                        setFormData(prev => ({
                                          ...prev,
                                          customUnits: prev.customUnits.filter((_, idx) => idx !== i),
                                          currentUnit: prev.currentUnit === unit ? "" : prev.currentUnit
                                        }));
                                      }}
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Admission Mode")}</label>
                      <select
                        name="admissionMode"
                        className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all"
                        value={formData.admissionMode}
                        onChange={handleChange}
                      >
                        <option value="">{t("Select Mode")}</option>
                        <option value="online">{t("Online")}</option>
                        <option value="offline">{t("Offline")}</option>
                        <option value="distance">{t("Distance")}</option>
                        <option value="regular">{t("Regular")}</option>
                        <option value="virtual">{t("Virtual")}</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Exam Mode")}</label>
                      <select
                        name="exam_mode"
                        className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all"
                        value={formData.exam_mode}
                        onChange={handleChange}
                      >
                        <option value="">{t("Select Mode")}</option>
                        <option value="online">{t("Online")}</option>
                        <option value="offline">{t("Offline")}</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Discount Coupon")}</label>
                      <div className="flex gap-2">
                        <input
                          name="coupon_code"
                          placeholder={t("Coupon Code")}
                          className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all uppercase"
                          value={formData.coupon_code}
                          onChange={handleChange}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="h-auto rounded-none border-primary text-primary font-black text-[10px] uppercase tracking-widest"
                          onClick={() => validateCoupon(formData.coupon_code)}
                        >
                          {t("Apply")}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Referral Code")}</label>
                      <div className="flex gap-2">
                        <input
                          name="referral_code_used"
                          placeholder={t("Referral Code")}
                          className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all uppercase"
                          value={formData.referral_code_used}
                          onChange={handleChange}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="h-auto rounded-none border-primary text-primary font-black text-[10px] uppercase tracking-widest"
                          onClick={() => validateReferral(formData.referral_code_used)}
                        >
                          {t("Verify")}
                        </Button>
                      </div>
                      {referralInfo && (
                        <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-tighter mt-1">
                          {t("Valid")}: {referralInfo.name} ({referralInfo.role})
                        </p>
                      )}
                    </div>

                    {/* <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Enrollment Date")}</label>
                      <input
                        name="registrationDate"
                        type="date"
                        className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all"
                        value={formData.registrationDate}
                        onChange={handleChange}
                      />
                    </div> */}

                    {selectedCourseDetails && (
                      <div className="md:col-span-3">
                        <div className="bg-primary/5 border border-primary/20 p-4 space-y-4">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">{t("Course Details")}</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{t("Duration")}:</p>
                              <p className="text-sm font-bold text-foreground">
                                {formatCourseDuration(selectedCourseDetails)}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{t("Units")}:</p>
                              <p className="text-sm font-bold text-foreground">
                                {formatCourseUnitsSummary(selectedCourseDetails)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="md:col-span-2">
                      <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex gap-6">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{t("Course")}:</p>
                            <p className="text-base font-black text-foreground">₹{courseFees.course.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">+ {t("Adm.")}:</p>
                            <p className="text-base font-black text-foreground">₹{courseFees.admission.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">+ {t("Exam")}:</p>
                            <p className="text-base font-black text-foreground">₹{courseFees.exam.toFixed(2)}</p>
                          </div>
                          {courseFees.discount > 0 && (
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-red-500">- {t("Disc.")}:</p>
                              <p className="text-base font-black text-red-500">₹{courseFees.discount.toFixed(2)}</p>
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">{t("Total")}:</p>
                          <p className="text-2xl font-black text-emerald-600">₹{courseFees.total.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section 2: Basic Details */}
              <Card className="rounded-none border-border shadow-md overflow-hidden border-t-4 border-t-emerald-600">
                <CardHeader className="bg-muted/30 border-b border-border py-4">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-emerald-700 flex items-center gap-2">
                    <User className="w-5 h-5" />
                    {t("Basic Details")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("First Name")} *</label>
                      <input name="firstName" required placeholder={t("First Name")} className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all" value={formData.firstName} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Middle Name")}</label>
                      <input name="middleName" placeholder={t("Middle Name")} className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all" value={formData.middleName} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Last Name")}</label>
                      <input name="lastName" placeholder={t("Last Name")} className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all" value={formData.lastName} onChange={handleChange} />
                    </div>

                    <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2 w-full">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Father's Name")}</label>
                        <input name="fatherName" placeholder={t("Father's Name")} className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all" value={formData.fatherName} onChange={handleChange} />
                      </div>
                      <div className="space-y-2 w-full">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Mother's Name")}</label>
                        <input name="motherName" placeholder={t("Mother's Name")} className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all" value={formData.motherName} onChange={handleChange} />
                      </div>
                    </div>

                    <div className="space-y-2 md:col-span-1">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Mobile No")} *</label>
                      <input name="phone" required placeholder="+91 1234567890" className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all" value={formData.phone} onChange={handleChange} />
                    </div>
                    <div className="space-y-2 md:col-span-1">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Email ID")} *</label>
                      <input name="email" required type="email" className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all" value={formData.email} onChange={handleChange} />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Gender")}</label>
                      <select name="gender" className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all" value={formData.gender} onChange={handleChange}>
                        <option value="">{t("Select Gender")}</option>
                        <option value="Male">{t("Male")}</option>
                        <option value="Female">{t("Female")}</option>
                        <option value="Other">{t("Other")}</option>
                      </select>
                      {formData.gender === "Other" && (
                        <input
                          name="otherGender"
                          placeholder={t("Enter Gender")}
                          className="w-full px-4 py-2 mt-2 rounded-none border border-primary/50 bg-background text-xs font-bold focus:border-primary focus:outline-none transition-all animate-in slide-in-from-top-1"
                          value={formData.otherGender}
                          onChange={handleChange}
                        />
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Date of Birth")}</label>
                      <input name="dob" type="date" className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all" value={formData.dob} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Category")}</label>
                      <select name="category" className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all" value={formData.category} onChange={handleChange}>
                        <option value="">{t("Select Category")}</option>
                        <option value="General">{t("General")}</option>
                        <option value="OBC">{t("OBC")}</option>
                        <option value="SC">{t("SC")}</option>
                        <option value="ST">{t("ST")}</option>
                        <option value="Other">{t("Other")}</option>
                      </select>
                      {formData.category === "Other" && (
                        <input
                          name="otherCategory"
                          placeholder={t("Enter Category")}
                          className="w-full px-4 py-2 mt-2 rounded-none border border-primary/50 bg-background text-xs font-bold focus:border-primary focus:outline-none transition-all animate-in slide-in-from-top-1"
                          value={formData.otherCategory}
                          onChange={handleChange}
                        />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section 3: Location Details */}
              <Card className="rounded-none border-border shadow-md overflow-hidden border-t-4 border-t-emerald-600">
                <CardHeader className="bg-muted/30 border-b border-border py-4">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-emerald-700 flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    {t("Location Details")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Country")}</label>
                      <input name="country" placeholder={t("Country")} className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all" value={formData.country} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("State")}</label>
                      <input name="state" placeholder={t("State")} className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all" value={formData.state} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("District")}</label>
                      <input name="district" placeholder={t("District")} className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all" value={formData.district} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("City")}</label>
                      <input name="city" placeholder={t("City")} className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all" value={formData.city} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Pincode")}</label>
                      <input name="pincode" className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all" value={formData.pincode} onChange={handleChange} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Full Address")}</label>
                      <textarea name="address" rows={1} className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all resize-none" value={formData.address} onChange={handleChange} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section 4: Emergency Contact */}
              <Card className="rounded-none border-border shadow-md overflow-hidden border-t-4 border-t-emerald-600">
                <CardHeader className="bg-muted/30 border-b border-border py-4">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-emerald-700 flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    {t("Emergency Contact")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Contact Person Name")}</label>
                      <input name="emergencyContactName" className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all" value={formData.emergencyContactName} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Relation")}</label>
                      <input name="emergencyContactRelation" className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all" value={formData.emergencyContactRelation} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Mobile No")}</label>
                      <input name="emergencyContactPhone" className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all" value={formData.emergencyContactPhone} onChange={handleChange} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section 5: Academic & Documents */}
              <Card className="rounded-none border-border shadow-md overflow-hidden border-t-4 border-t-emerald-600">
                <CardHeader className="bg-muted/30 border-b border-border py-4">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-emerald-700 flex items-center gap-2">
                    <GraduationCap className="w-5 h-5" />
                    {t("Academic & Documents")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Highest Qualification")}</label>
                      <select name="highestQualification" className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all" value={formData.highestQualification} onChange={handleChange}>
                        <option value="">{t("Select Qualification")}</option>
                        <option value="8th Standard">8th Standard</option>
                        <option value="10th Standard">10th Standard</option>
                        <option value="12th Standard">12th Standard</option>
                        <option value="Graduate">Graduate</option>
                        <option value="Post Graduate">Post Graduate</option>
                        <option value="Other">Other</option>
                      </select>
                      {formData.highestQualification === "Other" && (
                        <input
                          name="otherHighestQualification"
                          placeholder={t("Enter Qualification")}
                          className="w-full px-4 py-2 mt-2 rounded-none border border-primary/50 bg-background text-xs font-bold focus:border-primary focus:outline-none transition-all animate-in slide-in-from-top-1"
                          value={formData.otherHighestQualification}
                          onChange={handleChange}
                        />
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("National ID Type")}</label>
                      <select name="nationalIdType" className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all" value={formData.nationalIdType} onChange={handleChange}>
                        <option value="">{t("Select ID Type")}</option>
                        <option value="Passport">{t("Passport")}</option>
                        <option value="Aadhaar Card">{t("Aadhaar Card")}</option>
                        <option value="Government ID Card">{t("Government ID Card")}</option>
                        <option value="Driving License">{t("Driving License")}</option>
                        <option value="PAN Card">{t("PAN Card")}</option>
                        <option value="Voter ID">{t("Voter ID")}</option>
                        <option value="Other">{t("Other")}</option>
                      </select>
                      {formData.nationalIdType === "Other" && (
                        <input
                          name="otherNationalIdType"
                          placeholder={t("Enter ID Type")}
                          className="w-full px-4 py-2 mt-2 rounded-none border border-primary/50 bg-background text-xs font-bold focus:border-primary focus:outline-none transition-all animate-in slide-in-from-top-1"
                          value={formData.otherNationalIdType}
                          onChange={handleChange}
                        />
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("National ID Number")}</label>
                      <input name="nationalId" className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all" value={formData.nationalId} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Upload ID (PDF)")}</label>
                      <div className="flex items-center border border-border bg-background overflow-hidden">
                        <label className="px-4 py-3 bg-muted border-r border-border cursor-pointer hover:bg-muted/80 text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all">
                          {t("Choose file")}
                          <input type="file" className="hidden" accept=".pdf" onChange={(e) => handleDocUpload(e, "nationalIdUrl", "ID PDF")} />
                        </label>
                        <span className="px-4 text-[10px] font-bold text-muted-foreground truncate">{formData.nationalIdUrl ? formData.nationalIdUrl.split('/').pop() : t("No file chosen")}</span>
                      </div>
                    </div>

                    <div className="space-y-2 md:col-span-1">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Student Photo (Image)")}</label>
                      <div className="flex items-center border border-border bg-background overflow-hidden">
                        <label className="px-4 py-3 bg-muted border-r border-border cursor-pointer hover:bg-muted/80 text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all">
                          {t("Choose file")}
                          <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                        </label>
                        <span className="px-4 text-[10px] font-bold text-muted-foreground truncate">{formData.photoUrl ? formData.photoUrl.split('/').pop() : t("No file chosen")}</span>
                      </div>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Student Signature (Image)")}</label>
                      <div className="flex items-center border border-border bg-background overflow-hidden">
                        <label className="px-4 py-3 bg-muted border-r border-border cursor-pointer hover:bg-muted/80 text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all">
                          {t("Choose file")}
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => handleDocUpload(e, "signatureUrl", "Signature")} />
                        </label>
                        <span className="px-4 text-[10px] font-bold text-muted-foreground truncate">{formData.signatureUrl ? formData.signatureUrl.split('/').pop() : t("No file chosen")}</span>
                      </div>
                    </div>

                    <div className="md:col-span-3 space-y-4 pt-4">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Additional Documents")}</label>

                      {(formData.additionalDocuments || []).map((doc, index) => (
                        <div key={index} className="flex flex-wrap gap-4 p-4 border border-dashed border-border bg-muted/10 animate-in zoom-in-95">
                          <input
                            placeholder={t("Document Name (e.g. 8th Marksheet)")}
                            className="flex-1 min-w-[200px] px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all"
                            value={doc.name}
                            onChange={(e) => handleAdditionalDocChange(index, "name", e.target.value)}
                          />
                          <input
                            placeholder={t("Document Number")}
                            className="flex-1 min-w-[200px] px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all"
                            value={doc.number}
                            onChange={(e) => handleAdditionalDocChange(index, "number", e.target.value)}
                          />
                          <div className="flex items-center border border-border bg-background overflow-hidden flex-1 min-w-[200px]">
                            <label className="px-4 py-3 bg-muted border-r border-border cursor-pointer hover:bg-muted/80 text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all">
                              {t("Choose file")}
                              <input type="file" className="hidden" onChange={(e) => handleAdditionalDocUpload(index, e)} />
                            </label>
                            <span className="px-4 text-[10px] font-bold text-muted-foreground truncate">
                              {doc.url ? doc.url.split('/').pop() : t("No file chosen")}
                            </span>
                          </div>
                          <Button
                            variant="outline"
                            type="button"
                            className="h-auto rounded-none border-red-200 text-red-500 hover:bg-red-50"
                            onClick={() => removeDocument(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}

                      <Button
                        variant="secondary"
                        type="button"
                        onClick={addMoreDocument}
                        className="rounded-none bg-slate-600 text-white hover:bg-slate-700 text-[10px] font-black uppercase tracking-widest h-10 px-6"
                      >
                        + {t("Add More Document")}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section 6: Portal Access */}
              <Card className="rounded-none border-border shadow-md overflow-hidden border-t-4 border-t-emerald-600">
                <CardHeader className="bg-muted/30 border-b border-border py-4">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-emerald-700 flex items-center gap-2">
                    <Lock className="w-5 h-5" />
                    {t("Portal Access")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Login Email")} *</label>
                      <input
                        name="email"
                        required
                        disabled
                        className="w-full px-4 py-3 rounded-none border border-border bg-muted/50 text-sm font-bold cursor-not-allowed"
                        value={formData.email}
                      />
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">
                        {t("Student will use their email as login ID")}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Set Password")} *</label>
                      <div className="relative">
                        {/* Hidden decoys to distract browser credential managers */}
                        <input type="text" name="user_name_fake" style={{ display: 'none' }} tabIndex={-1} />
                        <input type="password" name="password_fake" style={{ display: 'none' }} tabIndex={-1} />

                        <input
                          name={passwordFieldName}
                          required
                          type={showPassword ? "text" : "password"}
                          className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all pr-12"
                          value={formData.password}
                          onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                          onFocus={(e) => e.target.removeAttribute('readonly')}
                          readOnly
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-primary transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <button
                type="submit"
                disabled={loading || uploading}
                className="w-full bg-emerald-600 text-white py-6 rounded-none font-heading font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {t("Review Enrollment Details")}
              </button>
            </div>
          </form>
        ) : step === 2 ? (
          <PreviewView />
        ) : (
          <div className="flex flex-col items-center justify-center py-20 space-y-6 animate-in fade-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-black uppercase tracking-tight text-foreground">{t("Enrollment Successful!")}</h2>
              <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">{t("Student account has been created and verified.")}</p>
            </div>
            <div className="flex flex-col w-full max-w-md gap-4 pt-6">
              <button
                onClick={downloadReceipt}
                className="w-full bg-emerald-600 text-white py-4 rounded-none font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-3"
              >
                <FileText className="w-4 h-4" />
                {t("Download Enrollment PDF")}
              </button>
              <button
                onClick={() => {
                  setFormData({ ...ADD_STUDENT_INITIAL });
                  setSelectedCourseDetails(null);
                  setStep(1);
                  setSubmittedStudent(null);
                }}
                className="w-full border border-border bg-background py-4 rounded-none font-black text-xs uppercase tracking-[0.2em] hover:bg-muted transition-all"
              >
                {t("Enroll Another Student")}
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AddStudentPage;
