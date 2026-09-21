import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  GraduationCap,
  User,
  Mail,
  Phone,
  BookOpen,
  Send,
  Loader2,
  MapPin,
  FileText,
  Camera,
  Upload,
  ArrowLeft,
  Eye,
  EyeOff,
  Trash2,
  Shield,
  Lock
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useNavigate, useParams } from "react-router-dom";
import { Link } from "react-router-dom";
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

const EditStudentPage = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [centerCourses, setCenterCourses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [customUnitInput, setCustomUnitInput] = useState("");
  const [selectedCourseDetails, setSelectedCourseDetails] = useState<any>(null);
  const [referralInfo, setReferralInfo] = useState<{ name: string, role: string } | null>(null);
  const [couponInfo, setCouponInfo] = useState<{ discount_type: string, discount_value: number } | null>(null);

  // Location-related state
  const [countries, setCountries] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [pincodes, setPincodes] = useState<any[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedPincode, setSelectedPincode] = useState<string | null>(null);
  const [customCountry, setCustomCountry] = useState<string>("");
  const [customState, setCustomState] = useState<string>("");
  const [customDistrict, setCustomDistrict] = useState<string>("");
  const [customCity, setCustomCity] = useState<string>("");
  const [customPincode, setCustomPincode] = useState<string>("");
  const [savedLocation, setSavedLocation] = useState<{
    country: string;
    state: string;
    district: string;
    city: string;
    pincode: string;
  } | null>(null);

  const [formData, setFormData] = useState({
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
    courseCategory: "",
    session_id: "",
    admissionMode: "",
    customAdmissionMode: "",
    exam_mode: "",
    customExamMode: "",
    batch_id: "",
    fatherName: "",
    motherName: "",
    dob: "",
    gender: "Male",
    otherGender: "",
    category: "General",
    otherCategory: "",
    nationalIdType: "Passport",
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
    highestQualification: "10th Standard",
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
    coupon_code: "",
    referral_code_used: "",
    autoGenerateEnrollment: true,
    autoGenerateRoll: true,
    additionalDocuments: [] as { name: string, number: string, url: string }[],
    currentUnit: "",
    customUnits: [] as string[],
  });

  const parsedAdditionalDocs = useMemo(() => {
    try {
      return JSON.parse(formData.additionalDocs || "{}");
    } catch {
      return {};
    }
  }, [formData.additionalDocs]);

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
        toast.error(t("Invalid referral code"));
      }
    } catch {
      setReferralInfo(null);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setFetchLoading(true);
      try {
        const [courseRes, sessionRes, batchRes, countryRes, categoriesRes] = await Promise.all([
          apiFetch("/api/courses/allot"),
          apiFetch("/api/academic/sessions"),
          apiFetch("/api/batches"),
          apiFetch("/api/public/locations/countries"),
          apiFetch("/api/public/categories?status=active"),
        ]);

        const list: any[] = [];
        if (courseRes.ok) {
          const data = await courseRes.json();
          list.push(...(Array.isArray(data) ? data : []));
          setCenterCourses(list);
        }

        if (categoriesRes.ok) {
          const data = await categoriesRes.json();
          if (data.items) {
            const catNames = data.items.map((cat: any) => cat.name);
            setCategories(catNames);
          }
        }

        if (sessionRes.ok) {
          const data = await sessionRes.json();
          console.log("EditStudentPage.tsx - sessions data:", data);
          setSessions(Array.isArray(data) ? data : []);
        }

        if (batchRes.ok) {
          const data = await batchRes.json();
          setBatches(Array.isArray(data) ? data.filter((b: any) => b.status === "active") : []);
        }

        if (countryRes.ok) {
          const data = await countryRes.json();
          setCountries(Array.isArray(data) ? data : []);
        }

        // Fetch student details
        const res = await apiFetch(`/api/students/${id}`);
        if (res.ok) {
          const student = await res.json();
          console.log("EditStudentPage.tsx - student data:", student);
          if (student) {
            let parsedDocs: any = {};
            if (student.additionalDocs) {
              try {
                parsedDocs = JSON.parse(student.additionalDocs);
              } catch {
                parsedDocs = {};
              }
            }

            const studentCategory = student.category || "General";
            const isStandardCategory = ["General", "OBC", "SC", "ST"].includes(studentCategory);

            const studentIdType = student.nationalIdType || "Passport";
            const isStandardIdType = ["Passport", "Aadhaar Card", "Government ID Card", "Driving License", "PAN Card", "Voter ID"].includes(studentIdType);

            const studentQual = student.highestQualification || "10th Standard";
            const isStandardQual = ["8th Standard", "10th Standard", "12th Standard", "Graduate", "Post Graduate"].includes(studentQual);

            const standardAdmissionModes = ["online", "offline", "distance", "regular", "virtual"];
            const studentAdmissionMode = student.admissionMode || "";
            const isStandardAdmissionMode = standardAdmissionModes.includes(studentAdmissionMode);

            const standardExamModes = ["online", "offline"];
            const studentExamMode = student.examMode || "";
            const isStandardExamMode = standardExamModes.includes(studentExamMode);

            const foundCourse = list.find((c: any) => c._id === student.courseId);
            if (foundCourse) {
              setSelectedCourseDetails(foundCourse);
            }
            console.log("EditStudentPage.tsx - Setting formData with student:", student);
            console.log("EditStudentPage.tsx - student.courseId:", student.courseId);
            console.log("EditStudentPage.tsx - student.sessionId:", student.sessionId);
            console.log("EditStudentPage.tsx - list (courses):", list);
            setSavedLocation({
              country: student.country || "",
              state: student.state || "",
              district: student.district || "",
              city: student.city || "",
              pincode: student.pincode || "",
            });

            setFormData({
              fullName: student.fullName || "",
              firstName: student.firstName || "",
              middleName: student.middleName || "",
              lastName: student.lastName || "",
              email: student.email || "",
              phone: student.phone || "",
              course: student.course || "",
              courseId: student.courseId || "",
              courseCategory: student.courseCategory || "",
              session_id: student.sessionId || "",
              admissionMode: isStandardAdmissionMode ? studentAdmissionMode : (studentAdmissionMode ? "custom" : ""),
              customAdmissionMode: isStandardAdmissionMode ? "" : studentAdmissionMode,
              exam_mode: isStandardExamMode ? studentExamMode : (studentExamMode ? "custom" : ""),
              customExamMode: isStandardExamMode ? "" : studentExamMode,
              batch_id: student.batchId || "",
              fatherName: student.fatherName || "",
              motherName: student.motherName || "",
              dob: student.dob || "",
              gender: ["Male", "Female"].includes(student.gender) ? student.gender : (student.gender ? "Other" : "Male"),
              otherGender: ["Male", "Female"].includes(student.gender) ? "" : (student.gender || ""),
              category: isStandardCategory ? studentCategory : "Other",
              otherCategory: isStandardCategory ? "" : studentCategory,
              nationalIdType: isStandardIdType ? studentIdType : "Other",
              otherNationalIdType: isStandardIdType ? "" : studentIdType,
              nationalId: student.nationalId || "",
              address: student.address || "",
              city: student.city || "",
              state: student.state || "",
              district: student.district || "",
              country: student.country || "",
              pincode: student.pincode || "",
              otherAddress: student.otherAddress || "",
              emergencyContactName: student.emergencyContactName || "",
              emergencyContactPhone: student.emergencyContactPhone || "",
              emergencyContactRelation: student.emergencyContactRelation || "",
              highestQualification: isStandardQual ? studentQual : "Other",
              otherHighestQualification: isStandardQual ? "" : studentQual,
              additionalDocs: student.additionalDocs || "",
              tenthDmcUrl: parsedDocs.tenth_dmc_url || "",
              nationalIdImageUrl: parsedDocs.national_id_image_url || "",
              nationalIdUrl: parsedDocs.national_id_url || "",
              signatureUrl: student.signatureUrl || parsedDocs.signature_url || "",
              otherDocName: parsedDocs.other_doc_name || "",
              otherDocUrl: parsedDocs.other_doc_url || "",
              enrollmentNumber: student.enrollmentNumber || "",
              rollNumber: student.rollNumber || "",
              registrationDate: student.registrationDate || "",
              photoUrl: student.photoUrl || "",
              sessionStartDate: student.sessionStartDate || "",
              sessionEndDate: student.sessionEndDate || "",
              username: student.username || "",
              password: "",
              additionalDocuments: Array.isArray(parsedDocs.additional_documents) ? parsedDocs.additional_documents : [],
              customUnits: Array.isArray(parsedDocs.custom_units) ? parsedDocs.custom_units : [],
              currentUnit: student.currentUnit || "",
            });
          } else {
            toast.error("Student not found");
            navigate("/dashboard/students");
          }
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
        toast.error("Failed to load student data");
      } finally {
        setFetchLoading(false);
      }
    };
    fetchData();
  }, [id, navigate]);

  // Hydrate country dropdown when countries load and we have saved location
  useEffect(() => {
    if (!savedLocation?.country || countries.length === 0) return;
    const country = countries.find((c) => c.name === savedLocation.country);
    if (country) {
      setSelectedCountry(country.id);
      setCustomCountry("");
    } else {
      setSelectedCountry("other");
      setCustomCountry(savedLocation.country);
    }
  }, [countries, savedLocation]);

  // Fetch states when selected country changes
  useEffect(() => {
    if (selectedCountry && selectedCountry !== "other") {
      const fetchStates = async () => {
        try {
          const res = await apiFetch(`/api/public/locations/states?country_id=${encodeURIComponent(selectedCountry)}`);
          if (res.ok) {
            const data = await res.json();
            const list = Array.isArray(data) ? data : [];
            setStates(list);

            if (savedLocation?.state) {
              const state = list.find((s: { id: string; name: string }) => s.name === savedLocation.state);
              if (state) {
                setSelectedState(state.id);
                setCustomState("");
              } else if (list.length > 0) {
                setSelectedState("other");
                setCustomState(savedLocation.state);
              }
            }
          }
        } catch (error) {
          console.error("Failed to fetch states:", error);
        }
      };
      fetchStates();
    } else if (selectedCountry !== "other") {
      setStates([]);
      setSelectedState(null);
      setCustomState("");
    }
  }, [selectedCountry, savedLocation?.state]);

  // Fetch districts when selected state changes
  useEffect(() => {
    if (selectedState && selectedState !== "other") {
      const fetchDistricts = async () => {
        try {
          const res = await apiFetch(`/api/public/locations/districts?state_id=${encodeURIComponent(selectedState)}`);
          if (res.ok) {
            const data = await res.json();
            const list = Array.isArray(data) ? data : [];
            setDistricts(list);

            if (savedLocation?.district) {
              const district = list.find((d: { id: string; name: string }) => d.name === savedLocation.district);
              if (district) {
                setSelectedDistrict(district.id);
                setCustomDistrict("");
              } else if (list.length > 0) {
                setSelectedDistrict("other");
                setCustomDistrict(savedLocation.district);
              }
            }
          }
        } catch (error) {
          console.error("Failed to fetch districts:", error);
        }
      };
      fetchDistricts();
    } else if (selectedState !== "other") {
      setDistricts([]);
      setSelectedDistrict(null);
      setCustomDistrict("");
    }
  }, [selectedState, savedLocation?.district]);

  // Fetch cities when selected district changes
  useEffect(() => {
    if (selectedDistrict && selectedDistrict !== "other") {
      const fetchCities = async () => {
        try {
          const res = await apiFetch(`/api/public/locations/cities?district_id=${encodeURIComponent(selectedDistrict)}`);
          if (res.ok) {
            const data = await res.json();
            const list = Array.isArray(data) ? data : [];
            setCities(list);

            if (savedLocation?.city) {
              const city = list.find((c: { id: string; name: string }) => c.name === savedLocation.city);
              if (city) {
                setSelectedCity(city.id);
                setCustomCity("");
              } else if (list.length > 0) {
                setSelectedCity("other");
                setCustomCity(savedLocation.city);
              }
            }
          }
        } catch (error) {
          console.error("Failed to fetch cities:", error);
        }
      };
      fetchCities();
    } else if (selectedDistrict !== "other") {
      setCities([]);
      setSelectedCity(null);
      setCustomCity("");
    }
  }, [selectedDistrict, savedLocation?.city]);

  // Fetch pincodes when selected city changes
  useEffect(() => {
    if (selectedCity && selectedCity !== "other") {
      const fetchPincodes = async () => {
        try {
          const res = await apiFetch(`/api/public/locations/pincodes?city_id=${encodeURIComponent(selectedCity)}`);
          if (res.ok) {
            const data = await res.json();
            const list = Array.isArray(data) ? data : [];
            setPincodes(list);

            if (savedLocation?.pincode) {
              const pincode = list.find((p: { id: string; name: string }) => p.name === savedLocation.pincode);
              if (pincode) {
                setSelectedPincode(pincode.id);
                setCustomPincode("");
              } else if (list.length > 0) {
                setSelectedPincode("other");
                setCustomPincode(savedLocation.pincode);
              }
            }
          }
        } catch (error) {
          console.error("Failed to fetch pincodes:", error);
        }
      };
      fetchPincodes();
    } else if (selectedCity !== "other") {
      setPincodes([]);
      setSelectedPincode(null);
      setCustomPincode("");
    }
  }, [selectedCity, savedLocation?.pincode]);

  const filteredCourses = useMemo(() => {
    if (!formData.courseCategory) return centerCourses;
    return centerCourses.filter(c => c.category === formData.courseCategory);
  }, [centerCourses, formData.courseCategory]);

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
      session_id: sid
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

  const handleAdditionalDocChange = (index: number, field: "name" | "number" | "url", value: string) => {
    const newDocs = [...formData.additionalDocuments];
    newDocs[index] = { ...newDocs[index], [field]: value };
    setFormData({ ...formData, additionalDocuments: newDocs });
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

  const addMoreDocument = () => {
    setFormData({
      ...formData,
      additionalDocuments: [...formData.additionalDocuments, { name: "", number: "", url: "" }]
    });
  };

  const removeDocument = (index: number) => {
    const newDocs = formData.additionalDocuments.filter((_, i) => i !== index);
    setFormData({ ...formData, additionalDocuments: newDocs });
  };

  const downloadEnrollmentPdf = async () => {
    if (!id) return;
    try {
      const res = await apiFetch(`/api/students/${id}/enrollment-pdf`);
      if (!res.ok) {
        toast.error(t("Failed to download PDF"));
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `enrollment_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error(t("Failed to download PDF"));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.course) {
      toast.error("Please select a course");
      return;
    }
    setLoading(true);

    try {
      console.log("EditStudentPage.tsx formData before submit:", formData);
      const docsPayload = {
        tenth_dmc_url: formData.tenthDmcUrl || undefined,
        national_id_image_url: formData.nationalIdImageUrl || undefined,
        national_id_url: formData.nationalIdUrl || undefined,
        signature_url: formData.signatureUrl || undefined,
        other_doc_name: formData.otherDocName || undefined,
        other_doc_url: formData.otherDocUrl || undefined,
        additional_documents: formData.additionalDocuments,
        custom_units: formData.customUnits,
      };
      const payload = {
        fullName: `${formData.firstName} ${formData.middleName ? formData.middleName + ' ' : ''}${formData.lastName}`.trim(),
        firstName: formData.firstName || undefined,
        middleName: formData.middleName || undefined,
        lastName: formData.lastName || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        course: formData.course || undefined,
        courseId: formData.courseId || undefined,
        courseCategory: formData.courseCategory || undefined,
        sessionId: formData.session_id || undefined,
        session_id: formData.session_id || undefined,
        admissionMode: formData.admissionMode === "custom" ? (formData.customAdmissionMode || undefined) : (formData.admissionMode || undefined),
        exam_mode: formData.exam_mode === "custom" ? (formData.customExamMode || undefined) : (formData.exam_mode || undefined),
        batchId: formData.batch_id || undefined,
        batch_id: formData.batch_id || undefined,
        fatherName: formData.fatherName || undefined,
        motherName: formData.motherName || undefined,
        dob: formData.dob || undefined,
        gender: formData.gender === "Other" ? (formData.otherGender || undefined) : (formData.gender || undefined),
        category: formData.category === "Other" ? (formData.otherCategory || undefined) : (formData.category || undefined),
        nationalIdType: formData.nationalIdType === "Other" ? (formData.otherNationalIdType || undefined) : (formData.nationalIdType || undefined),
        nationalId: formData.nationalId || undefined,
        address: formData.address || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
        district: formData.district || undefined,
        country: formData.country || undefined,
        pincode: formData.pincode || undefined,
        otherAddress: formData.otherAddress || undefined,
        emergencyContactName: formData.emergencyContactName || undefined,
        emergencyContactPhone: formData.emergencyContactPhone || undefined,
        emergencyContactRelation: formData.emergencyContactRelation || undefined,
        highestQualification: formData.highestQualification === "Other" ? (formData.otherHighestQualification || undefined) : (formData.highestQualification || undefined),
        additionalDocs: JSON.stringify(docsPayload),
        enrollmentNumber: formData.enrollmentNumber || undefined,
        rollNumber: formData.rollNumber || undefined,
        registrationDate: formData.registrationDate || undefined,
        photoUrl: formData.photoUrl || undefined,
        signatureUrl: formData.signatureUrl || undefined,
        sessionStartDate: formData.sessionStartDate || undefined,
        sessionEndDate: formData.sessionEndDate || undefined,
        username: formData.username || undefined,
        currentUnit: formData.currentUnit || undefined,
        current_unit: formData.currentUnit || undefined,
        password: formData.password || undefined, // Only send if changed
      };
      console.log("EditStudentPage payload being sent:", payload);
      const response = await apiFetch(`/api/students/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(data.message);
        navigate("/dashboard/students");
      } else {
        toast.error(data.message || "Failed to update student account");
      }
    } catch (error) {
      console.error("Error updating student:", error);
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (fetchLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Loading Student Data...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
        <div className="flex items-center justify-between border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <Link to="/dashboard/students" className="p-2 hover:bg-muted transition-colors border border-border">
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight flex items-center gap-3">
                <GraduationCap className="w-8 h-8 text-primary" />
                {t("Edit Student")}
              </h1>
            </div>
            <p className="text-muted-foreground mt-1 text-sm font-medium uppercase tracking-wider ml-12">Update student registration details and system access.</p>
          </div>
        </div>

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

                          options.push(<option key="custom-option" value="custom">{t("Custom")}</option>);

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
                      <option value="custom">{t("Custom")}</option>
                    </select>
                    {formData.admissionMode === "custom" && (
                      <input
                        name="customAdmissionMode"
                        placeholder={t("Enter custom admission mode")}
                        className="w-full px-4 py-3 mt-2 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all"
                        value={formData.customAdmissionMode}
                        onChange={handleChange}
                      />
                    )}
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
                      <option value="custom">{t("Custom")}</option>
                    </select>
                    {formData.exam_mode === "custom" && (
                      <input
                        name="customExamMode"
                        placeholder={t("Enter custom exam mode")}
                        className="w-full px-4 py-3 mt-2 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all"
                        value={formData.customExamMode}
                        onChange={handleChange}
                      />
                    )}
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
                </div>

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
                    <input name="firstName" required className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all" value={formData.firstName} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Middle Name")}</label>
                    <input name="middleName" className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all" value={formData.middleName} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Last Name")}</label>
                    <input name="lastName" className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all" value={formData.lastName} onChange={handleChange} />
                  </div>

                  <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 w-full">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Father's Name")}</label>
                      <input name="fatherName" className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all" value={formData.fatherName} onChange={handleChange} />
                    </div>
                    <div className="space-y-2 w-full">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Mother's Name")}</label>
                      <input name="motherName" className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all" value={formData.motherName} onChange={handleChange} />
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
                    <select
                      className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all"
                      value={selectedCountry || ""}
                      onChange={(e) => {
                        setSavedLocation(null);
                        const value = e.target.value || null;
                        setSelectedCountry(value);
                        setCustomCountry("");
                        setSelectedState(null);
                        setSelectedDistrict(null);
                        setSelectedCity(null);
                        setSelectedPincode(null);
                        setCustomState("");
                        setCustomDistrict("");
                        setCustomCity("");
                        setCustomPincode("");
                        setStates([]);
                        setDistricts([]);
                        setCities([]);
                        setPincodes([]);
                        if (!value) {
                          setFormData(prev => ({ ...prev, country: "", state: "", district: "", city: "", pincode: "" }));
                        } else if (value !== "other") {
                          const country = countries.find(c => c.id === value);
                          setFormData(prev => ({ ...prev, country: country?.name || "", state: "", district: "", city: "", pincode: "" }));
                        } else {
                          setFormData(prev => ({ ...prev, country: "", state: "", district: "", city: "", pincode: "" }));
                        }
                      }}
                    >
                      <option value="">{t("Select Country")}</option>
                      <option value="other">{t("Other (Enter manually)")}</option>
                      {countries.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {selectedCountry === "other" && (
                      <input
                        placeholder={t("Enter Country Name")}
                        className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all mt-2"
                        value={customCountry}
                        onChange={(e) => {
                          setCustomCountry(e.target.value);
                          setFormData(prev => ({ ...prev, country: e.target.value }));
                        }}
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("State")}</label>
                    <select
                      className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all"
                      value={selectedState || ""}
                      onChange={(e) => {
                        setSavedLocation(null);
                        const value = e.target.value || null;
                        setSelectedState(value);
                        setCustomState("");
                        setSelectedDistrict(null);
                        setSelectedCity(null);
                        setSelectedPincode(null);
                        setCustomDistrict("");
                        setCustomCity("");
                        setCustomPincode("");
                        setDistricts([]);
                        setCities([]);
                        setPincodes([]);
                        if (!value) {
                          setFormData(prev => ({ ...prev, state: "", district: "", city: "", pincode: "" }));
                        } else if (value !== "other") {
                          const state = states.find(s => s.id === value);
                          setFormData(prev => ({ ...prev, state: state?.name || "", district: "", city: "", pincode: "" }));
                        } else {
                          setFormData(prev => ({ ...prev, state: "", district: "", city: "", pincode: "" }));
                        }
                      }}
                    >
                      <option value="">{t("Select State")}</option>
                      <option value="other">{t("Other (Enter manually)")}</option>
                      {states.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    {selectedState === "other" && (
                      <input
                        placeholder={t("Enter State Name")}
                        className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all mt-2"
                        value={customState}
                        onChange={(e) => {
                          setCustomState(e.target.value);
                          setFormData(prev => ({ ...prev, state: e.target.value }));
                        }}
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("District")}</label>
                    <select
                      className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all"
                      value={selectedDistrict || ""}
                      onChange={(e) => {
                        setSavedLocation(null);
                        const value = e.target.value || null;
                        setSelectedDistrict(value);
                        setCustomDistrict("");
                        setSelectedCity(null);
                        setSelectedPincode(null);
                        setCustomCity("");
                        setCustomPincode("");
                        setCities([]);
                        setPincodes([]);
                        if (!value) {
                          setFormData(prev => ({ ...prev, district: "", city: "", pincode: "" }));
                        } else if (value !== "other") {
                          const district = districts.find(d => d.id === value);
                          setFormData(prev => ({ ...prev, district: district?.name || "", city: "", pincode: "" }));
                        } else {
                          setFormData(prev => ({ ...prev, district: "", city: "", pincode: "" }));
                        }
                      }}
                    >
                      <option value="">{t("Select District")}</option>
                      <option value="other">{t("Other (Enter manually)")}</option>
                      {districts.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    {selectedDistrict === "other" && (
                      <input
                        placeholder={t("Enter District Name")}
                        className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all mt-2"
                        value={customDistrict}
                        onChange={(e) => {
                          setCustomDistrict(e.target.value);
                          setFormData(prev => ({ ...prev, district: e.target.value }));
                        }}
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("City")}</label>
                    <select
                      className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all"
                      value={selectedCity || ""}
                      onChange={(e) => {
                        setSavedLocation(null);
                        const value = e.target.value || null;
                        setSelectedCity(value);
                        setCustomCity("");
                        setSelectedPincode(null);
                        setCustomPincode("");
                        setPincodes([]);
                        if (!value) {
                          setFormData(prev => ({ ...prev, city: "", pincode: "" }));
                        } else if (value !== "other") {
                          const city = cities.find(c => c.id === value);
                          setFormData(prev => ({ ...prev, city: city?.name || "", pincode: "" }));
                        } else {
                          setFormData(prev => ({ ...prev, city: "", pincode: "" }));
                        }
                      }}
                    >
                      <option value="">{t("Select City")}</option>
                      <option value="other">{t("Other (Enter manually)")}</option>
                      {cities.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {selectedCity === "other" && (
                      <input
                        placeholder={t("Enter City Name")}
                        className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all mt-2"
                        value={customCity}
                        onChange={(e) => {
                          setCustomCity(e.target.value);
                          setFormData(prev => ({ ...prev, city: e.target.value }));
                        }}
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Pincode")}</label>
                    <select
                      className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all"
                      value={selectedPincode || ""}
                      onChange={(e) => {
                        setSavedLocation(null);
                        const value = e.target.value || null;
                        setSelectedPincode(value);
                        setCustomPincode("");
                        if (!value) {
                          setFormData(prev => ({ ...prev, pincode: "" }));
                        } else if (value !== "other") {
                          const pincode = pincodes.find(p => p.id === value);
                          setFormData(prev => ({ ...prev, pincode: pincode?.name || "" }));
                        } else {
                          setFormData(prev => ({ ...prev, pincode: "" }));
                        }
                      }}
                    >
                      <option value="">{t("Select Pincode")}</option>
                      <option value="other">{t("Other (Enter manually)")}</option>
                      {pincodes.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    {selectedPincode === "other" && (
                      <input
                        placeholder={t("Enter Pincode")}
                        className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all mt-2"
                        value={customPincode}
                        onChange={(e) => {
                          setCustomPincode(e.target.value);
                          setFormData(prev => ({ ...prev, pincode: e.target.value }));
                        }}
                      />
                    )}
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

            {/* Summary aligned with enrollment PDF (includes district) */}
            <Card className="rounded-none border-border shadow-md overflow-hidden border-t-4 border-t-slate-600">
              <CardHeader className="bg-muted/30 border-b border-border py-4">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  {t("Registration Preview")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="text-[11px] grid grid-cols-12 gap-2">
                  <span className="col-span-2 font-black text-muted-foreground uppercase">{t("Location")}:</span>
                  <span className="col-span-10 font-bold uppercase">
                    {[formData.country, formData.state, formData.district, formData.city, formData.address, formData.pincode]
                      .filter((s) => String(s || "").trim())
                      .join(", ") || "—"}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-none text-[10px] font-black uppercase tracking-widest gap-2"
                  onClick={() => void downloadEnrollmentPdf()}
                >
                  <FileText className="w-4 h-4" />
                  {t("Download Enrollment PDF")}
                </Button>
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
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Set New Password")} *</label>
                    <div className="relative">
                      <input
                        name="password"
                        type={showPassword ? "text" : "password"}
                        className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all pr-12"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder={t("Leave blank to keep current password")}
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
              {t("Update Student Details")}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default EditStudentPage;
