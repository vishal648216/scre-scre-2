
import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  User,
  BookOpen,
  MapPin,
  Shield,
  GraduationCap,
  Camera,
  Upload,
  Lock,
  Send,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  ArrowLeft
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";

const EditInternPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFieldName] = useState(`pwd_${Math.random().toString(36).substring(7)}`);

  const [internships, setInternships] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedInternshipDetails, setSelectedInternshipDetails] = useState<any>(null);
  const [referralInfo, setReferralInfo] = useState<{ name: string, role: string } | null>(null);
  const [couponInfo, setCouponInfo] = useState<{ discount_type: string, discount_value: number } | null>(null);

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
  const [colleges, setColleges] = useState<any[]>([]);

  // Validation states
  const [emailExists, setEmailExists] = useState(false);
  const [enrollmentExists, setEnrollmentExists] = useState(false);
  const [serialExists, setSerialExists] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [checkingEnrollment, setCheckingEnrollment] = useState(false);
  const [checkingSerial, setCheckingSerial] = useState(false);

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    fullName: "",
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phone: "",
    internshipDomain: "",
    session_id: "",
    registrationDate: "",
    sessionStartDate: "",
    sessionEndDate: "",
    internshipMode: "",
    otherInternshipMode: "",
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
    college: "",
    additionalDocs: "",
    nationalIdUrl: "",
    signatureUrl: "",
    photoUrl: "",
    additionalDocuments: [] as { name: string; number: string; url: string }[],
    currentUnit: "",
    customUnits: [] as string[],
    enrollmentNumber: "",
    serialNumber: "",
    referralCodeUsed: "",
    couponCode: "",
  });

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [courseRes, sessionRes, countryRes, internRes, categoriesRes, collegesRes] = await Promise.all([
          apiFetch("/api/courses/allot"),
          apiFetch("/api/academic/sessions"),
          apiFetch("/api/public/locations/countries"),
          id ? apiFetch(`/api/interns/${id}`) : Promise.resolve(null),
          apiFetch("/api/public/categories?limit=100"), // Fetch all categories
          apiFetch("/api/admin/colleges"),
        ]);

        let coursesData: any[] = [];
        let sessionsData: any[] = [];
        let countryData: any[] = [];
        let categoriesData: string[] = [];
        let collegesData: any[] = [];

        if (courseRes.ok) {
          const data = await courseRes.json();
          coursesData = Array.isArray(data) ? data : [];
          setInternships(coursesData);
        }

        if (categoriesRes.ok) {
          const data = await categoriesRes.json();
          categoriesData = data.items?.map((cat: any) => cat.name) || [];
          setCategories(categoriesData);
        }

        if (sessionRes.ok) {
          const data = await sessionRes.json();
          sessionsData = Array.isArray(data) ? data : [];
          setSessions(sessionsData);
        }

        if (countryRes.ok) {
          countryData = await countryRes.json();
          setCountries(Array.isArray(countryData) ? countryData : []);
        }

        if (collegesRes.ok) {
          const data = await collegesRes.json();
          collegesData = Array.isArray(data) ? [...data].sort((a, b) => a.name.localeCompare(b.name)) : [];
          setColleges(collegesData);
        }

        if (internRes && internRes.ok) {
          const intern = await internRes.json();

          // Find country, state, district, city, pincode
          let finalSelectedCountry: string | null = null;
          let finalCustomCountry = "";
          let finalSelectedState: string | null = null;
          let finalCustomState = "";
          let finalSelectedDistrict: string | null = null;
          let finalCustomDistrict = "";
          let finalSelectedCity: string | null = null;
          let finalCustomCity = "";
          let finalSelectedPincode: string | null = null;
          let finalCustomPincode = "";



          // First, set all data except location-related ones
          setFormData({
            ...formData,
            ...intern,
            college: intern.college || "",
            fullName: `${intern.firstName || ''} ${intern.middleName || ''} ${intern.lastName || ''}`.trim(),
            additionalDocuments: intern.additionalDocuments || [],
            customUnits: intern.customUnits || [],
            enrollmentNumber: intern.enrollmentNumber || "",
            serialNumber: intern.serialNumber || "",
            referralCodeUsed: intern.referralCodeUsed || "",
            couponCode: intern.couponCode || ""
          });

          // Handle internship selection - use coursesData directly from API
          let foundInternship: any = null;
          if (intern.internshipDomain) {
            foundInternship = coursesData.find((c: any) => c.course_name === intern.internshipDomain);
            if (foundInternship) {
              setSelectedInternshipDetails(foundInternship);
            }
          }

          // Wait for countries to load before handling location stuff
          if (countryRes.ok) {
            if (intern.country) {
              const foundCountry = countryData.find((c: any) => c.name === intern.country);
              if (foundCountry) {
                finalSelectedCountry = foundCountry.id;
              } else {
                finalSelectedCountry = "other";
                finalCustomCountry = intern.country;
              }
            }

            setSelectedCountry(finalSelectedCountry);
            setCustomCountry(finalCustomCountry);

            if (finalSelectedCountry && finalSelectedCountry !== "other") {
              const statesRes = await apiFetch(`/api/public/locations/states?country_id=${encodeURIComponent(finalSelectedCountry)}`);
              if (statesRes.ok) {
                const statesDataFromAPI = await statesRes.json();
                setStates(statesDataFromAPI);

                if (intern.state) {
                  const foundState = statesDataFromAPI.find((s: any) => s.name === intern.state);
                  if (foundState) {
                    finalSelectedState = foundState.id;
                  } else {
                    finalSelectedState = "other";
                    finalCustomState = intern.state;
                  }
                }

                setSelectedState(finalSelectedState);
                setCustomState(finalCustomState);

                if (finalSelectedState && finalSelectedState !== "other") {
                  const districtsRes = await apiFetch(`/api/public/locations/districts?state_id=${encodeURIComponent(finalSelectedState)}`);
                  if (districtsRes.ok) {
                    const districtsDataFromAPI = await districtsRes.json();
                    setDistricts(districtsDataFromAPI);

                    if (intern.district) {
                      const foundDistrict = districtsDataFromAPI.find((d: any) => d.name === intern.district);
                      if (foundDistrict) {
                        finalSelectedDistrict = foundDistrict.id;
                      } else {
                        finalSelectedDistrict = "other";
                        finalCustomDistrict = intern.district;
                      }
                    }

                    setSelectedDistrict(finalSelectedDistrict);
                    setCustomDistrict(finalCustomDistrict);

                    if (finalSelectedDistrict && finalSelectedDistrict !== "other") {
                      const citiesRes = await apiFetch(`/api/public/locations/cities?district_id=${encodeURIComponent(finalSelectedDistrict)}`);
                      if (citiesRes.ok) {
                        const citiesDataFromAPI = await citiesRes.json();
                        setCities(citiesDataFromAPI);

                        if (intern.city) {
                          const foundCity = citiesDataFromAPI.find((c: any) => c.name === intern.city);
                          if (foundCity) {
                            finalSelectedCity = foundCity.id;
                          } else {
                            finalSelectedCity = "other";
                            finalCustomCity = intern.city;
                          }
                        }

                        setSelectedCity(finalSelectedCity);
                        setCustomCity(finalCustomCity);

                        if (finalSelectedCity && finalSelectedCity !== "other") {
                          const pincodesRes = await apiFetch(`/api/public/locations/pincodes?city_id=${encodeURIComponent(finalSelectedCity)}`);
                          if (pincodesRes.ok) {
                            const pincodesDataFromAPI = await pincodesRes.json();
                            setPincodes(pincodesDataFromAPI);

                            if (intern.pincode) {
                              const foundPincode = pincodesDataFromAPI.find((p: any) => p.name === intern.pincode);
                              if (foundPincode) {
                                finalSelectedPincode = foundPincode.id;
                              } else {
                                finalSelectedPincode = "other";
                                finalCustomPincode = intern.pincode;
                              }
                            }

                            setSelectedPincode(finalSelectedPincode);
                            setCustomPincode(finalCustomPincode);
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch initial data:", error);
      }
    };
    fetchInitialData();
  }, [id]);

  // Debounced email check
  useEffect(() => {
    if (!formData.email) {
      setEmailExists(false);
      return;
    }
    const timer = setTimeout(async () => {
      setCheckingEmail(true);
      try {
        const res = await apiFetch(`/api/interns/check-email?email=${encodeURIComponent(formData.email)}&excludeId=${id}`);
        if (res.ok) {
          const data = await res.json();
          setEmailExists(data.exists);
        }
      } catch (error) {
        console.error("Failed to check email:", error);
      } finally {
        setCheckingEmail(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.email, id]);

  // Debounced enrollment check
  useEffect(() => {
    if (!formData.enrollmentNumber) {
      setEnrollmentExists(false);
      return;
    }
    const timer = setTimeout(async () => {
      setCheckingEnrollment(true);
      try {
        const res = await apiFetch(`/api/interns/check-enrollment?enrollmentNumber=${encodeURIComponent(formData.enrollmentNumber)}&excludeId=${id}`);
        if (res.ok) {
          const data = await res.json();
          setEnrollmentExists(data.exists);
        }
      } catch (error) {
        console.error("Failed to check enrollment:", error);
      } finally {
        setCheckingEnrollment(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.enrollmentNumber, id]);

  // Debounced serial check
  useEffect(() => {
    if (!formData.serialNumber) {
      setSerialExists(false);
      return;
    }
    const timer = setTimeout(async () => {
      setCheckingSerial(true);
      try {
        const res = await apiFetch(`/api/interns/check-serial?serialNumber=${encodeURIComponent(formData.serialNumber)}&excludeId=${id}`);
        if (res.ok) {
          const data = await res.json();
          setSerialExists(data.exists);
        }
      } catch (error) {
        console.error("Failed to check serial:", error);
      } finally {
        setCheckingSerial(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.serialNumber, id]);

  useEffect(() => {
    if (selectedCountry && selectedCountry !== "other") {
      const fetchStates = async () => {
        try {
          const res = await apiFetch(`/api/public/locations/states?country_id=${encodeURIComponent(selectedCountry)}`);
          if (res.ok) {
            const data = await res.json();
            setStates(Array.isArray(data) ? data : []);
          }
        } catch (error) {
          console.error("Failed to fetch states:", error);
        }
      };
      fetchStates();
    } else {
      setStates([]);
    }
  }, [selectedCountry]);

  useEffect(() => {
    if (selectedState && selectedState !== "other") {
      const fetchDistricts = async () => {
        try {
          const res = await apiFetch(`/api/public/locations/districts?state_id=${encodeURIComponent(selectedState)}`);
          if (res.ok) {
            const data = await res.json();
            setDistricts(Array.isArray(data) ? data : []);
          }
        } catch (error) {
          console.error("Failed to fetch districts:", error);
        }
      };
      fetchDistricts();
    } else {
      setDistricts([]);
    }
  }, [selectedState]);

  useEffect(() => {
    if (selectedDistrict && selectedDistrict !== "other") {
      const fetchCities = async () => {
        try {
          const res = await apiFetch(`/api/public/locations/cities?district_id=${encodeURIComponent(selectedDistrict)}`);
          if (res.ok) {
            const data = await res.json();
            setCities(Array.isArray(data) ? data : []);
          }
        } catch (error) {
          console.error("Failed to fetch cities:", error);
        }
      };
      fetchCities();
    } else {
      setCities([]);
    }
  }, [selectedDistrict]);

  useEffect(() => {
    if (selectedCity && selectedCity !== "other") {
      const fetchPincodes = async () => {
        try {
          const res = await apiFetch(`/api/public/locations/pincodes?city_id=${encodeURIComponent(selectedCity)}`);
          if (res.ok) {
            const data = await res.json();
            setPincodes(Array.isArray(data) ? data : []);
          }
        } catch (error) {
          console.error("Failed to fetch pincodes:", error);
        }
      };
      fetchPincodes();
    } else {
      setPincodes([]);
    }
  }, [selectedCity]);

  const filteredInternships = useMemo(() => {
    if (!formData.category) return internships;
    return internships.filter(c => c.category === formData.category);
  }, [internships, formData.category]);

  const handleInternshipChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cid = e.target.value;
    const internship = internships.find(c => c._id === cid);
    if (internship) {
      setFormData(prev => ({
        ...prev,
        internshipDomain: internship.course_name,
        session_id: "",
        sessionEndDate: ""
      }));
      setSelectedInternshipDetails(internship);
    } else {
      setFormData(prev => ({ ...prev, internshipDomain: "", session_id: "", sessionEndDate: "" }));
      setSelectedInternshipDetails(null);
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

  const validateCoupon = async (code: string) => {
    if (!code) {
      setCouponInfo(null);
      return;
    }
    try {
      const res = await apiFetch(`/api/coupons/validate?code=${code}`);
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
    key: "nationalIdUrl" | "signatureUrl",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const confirmSubmit = async () => {
    console.log("[EditInternPage] confirmSubmit called, emailExists:", emailExists, "enrollmentExists:", enrollmentExists, "serialExists:", serialExists);
    if (emailExists) {
      toast.error("Email already exists");
      return;
    }
    if (enrollmentExists) {
      toast.error("Enrollment number already exists");
      return;
    }
    if (serialExists) {
      toast.error("Serial number already exists");
      return;
    }

    setLoading(true);
    try {
      const docsPayload = {
        nationalIdUrl: formData.nationalIdUrl || undefined,
        signatureUrl: formData.signatureUrl || undefined,
        emergencyContactRelation: formData.emergencyContactRelation || undefined,
        otherDocs: formData.additionalDocuments,
        customUnits: formData.customUnits,
      };

      const payload = {
        ...formData,
        username: formData.email,
        gender: formData.gender === "Other" ? formData.otherGender : formData.gender,
        category: formData.category === "Other" ? formData.otherCategory : formData.category,
        highestQualification: formData.highestQualification === "Other" ? formData.otherHighestQualification : formData.highestQualification,
        additionalDocs: JSON.stringify(docsPayload),
        session_id: formData.session_id || undefined,
        enrollmentNumber: formData.enrollmentNumber || undefined,
        serialNumber: formData.serialNumber || undefined,
      };

      if (!payload.password) {
        delete payload.password;
      }
      const finalPayload = {
        ...payload,
        registrationDate: formData.registrationDate || undefined,
      };
      console.log("[EditInternPage] complete payload before PUT request:", finalPayload);
      console.log("[EditInternPage] stringified PUT body:", JSON.stringify(finalPayload));

      const response = await apiFetch(`/api/interns/${id}`, {
        method: "PUT",
        body: JSON.stringify(finalPayload),
      });

      console.log("[EditInternPage] response status:", response.status, "ok:", response.ok);

      if (response.ok) {
        toast.success("Intern updated successfully");
        setStep(3);
      } else {
        const data = await response.json().catch(() => ({ message: "Failed to update intern" }));
        console.log("[EditInternPage] response data:", data);
        toast.error(data.message || "Failed to update intern");
      }
    } catch (error) {
      console.error("[EditInternPage] update failed:", error);
      toast.error("An error occurred during update");
    } finally {
      setLoading(false);
    }
  };

  const PreviewView = () => (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="bg-primary/5 border border-primary/20 p-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-primary">{t("Preview Intern Details")}</h2>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("Please review all information before final update.")}</p>
        </div>
        <div className="flex gap-3">
          <button className="px-6 py-2 border border-border text-[10px] font-black uppercase tracking-widest hover:bg-muted" onClick={() => setStep(1)}>
            {t("Edit Details")}
          </button>
          <button className="px-6 py-2 bg-primary text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90 flex items-center gap-3" onClick={confirmSubmit} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {t("Confirm & Update")}
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
              <span className="font-black text-muted-foreground uppercase">{t("Internship Domain")}:</span>
              <span className="font-bold uppercase">{formData.internshipDomain}</span>
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
        <button className="px-12 py-3 bg-primary text-white text-xs font-black uppercase tracking-widest hover:opacity-90 flex items-center gap-3" onClick={confirmSubmit} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {t("Confirm Update")}
        </button>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
        <div className="flex items-center justify-between border-b border-border pb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 border border-border rounded-none hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight flex items-center gap-3">
                <GraduationCap className="w-8 h-8 text-primary" />
                {step === 1 ? t("Edit Intern") : step === 2 ? t("Confirm Intern Details") : t("Update Successful!")}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm font-medium uppercase tracking-wider">
                {step === 1
                  ? t("Update intern details and information.")
                  : step === 2
                    ? t("Review the information below and confirm to update the intern.")
                    : t("Intern account has been updated successfully.")}
              </p>
            </div>
          </div>
        </div>

        {step === 1 ? (
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="flex flex-col gap-8">
              <Card className="rounded-none border-border shadow-md overflow-hidden border-t-4 border-t-emerald-600">
                <CardHeader className="bg-muted/30 border-b border-border py-4">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-emerald-700 flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    {t("Internship Details")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Select Category")}</label>
                      <select
                        name="category"
                        className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all"
                        value={formData.category}
                        onChange={handleChange}
                      >
                        <option value="">{t("Select Category")}</option>
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>{t(cat)}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Select Internship")}</label>
                      <select
                        name="internshipId"
                        className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all"
                        value={selectedInternshipDetails?._id || ""}
                        onChange={handleInternshipChange}
                      >
                        <option value="">{t("Select Internship")}</option>
                        {filteredInternships.map((c) => <option key={c._id} value={c._id}>{t(c.course_name)}</option>)}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Select Session")}</label>
                      <select
                        name="session_id"
                        className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all"
                        value={formData.session_id}
                        onChange={handleSessionChange}
                      >
                        <option value="">{t("Select Session")}</option>
                        {sessions
                          .filter(s => s.course_id === selectedInternshipDetails?._id)
                          .map((s) => <option key={s.id} value={s.id}>{s.session_name}</option>)}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Enrollment Number")}</label>
                      <input
                        name="enrollmentNumber"
                        type="text"
                        className={cn(
                          "w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:outline-none transition-all",
                          enrollmentExists ? "border-red-500 focus:border-red-500" : "focus:border-primary"
                        )}
                        value={formData.enrollmentNumber}
                        onChange={handleChange}
                      />
                      {checkingEnrollment && <p className="text-xs text-muted-foreground">Checking...</p>}
                      {enrollmentExists && <p className="text-xs text-red-500">Enrollment number already exists</p>}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Serial Number")}</label>
                      <input
                        name="serialNumber"
                        type="text"
                        className={cn(
                          "w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:outline-none transition-all",
                          serialExists ? "border-red-500 focus:border-red-500" : "focus:border-primary"
                        )}
                        value={formData.serialNumber}
                        onChange={handleChange}
                      />
                      {checkingSerial && <p className="text-xs text-muted-foreground">Checking...</p>}
                      {serialExists && <p className="text-xs text-red-500">Serial number already exists</p>}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Registration Date")}</label>
                      <input
                        name="registrationDate"
                        type="date"
                        className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all"
                        value={formData.registrationDate}
                        onChange={handleChange}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Internship Start Date")}</label>
                      <input
                        name="sessionStartDate"
                        type="date"
                        className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all"
                        value={formData.sessionStartDate}
                        onChange={handleStartDateChange}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Internship End Date")}</label>
                      <input
                        name="sessionEndDate"
                        type="date"
                        className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all"
                        value={formData.sessionEndDate}
                        onChange={handleChange}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Discount Coupon")}</label>
                      <div className="flex gap-2">
                        <input
                          name="couponCode"
                          placeholder={t("Coupon Code")}
                          className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all uppercase"
                          value={formData.couponCode}
                          onChange={handleChange}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="h-auto rounded-none border-primary text-primary font-black text-[10px] uppercase tracking-widest"
                          onClick={() => validateCoupon(formData.couponCode)}
                        >
                          {t("Apply")}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Referral Code")}</label>
                      <div className="flex gap-2">
                        <input
                          name="referralCodeUsed"
                          placeholder={t("Referral Code")}
                          className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all uppercase"
                          value={formData.referralCodeUsed}
                          onChange={handleChange}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="h-auto rounded-none border-primary text-primary font-black text-[10px] uppercase tracking-widest"
                          onClick={() => validateReferral(formData.referralCodeUsed)}
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

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Internship Mode")}</label>
                      <select
                        name="internshipMode"
                        className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all"
                        value={formData.internshipMode}
                        onChange={handleChange}
                      >
                        <option value="">{t("Select Internship Mode")}</option>
                        <option value="Online">{t("Online")}</option>
                        <option value="Offline">{t("Offline")}</option>
                        <option value="Hybrid">{t("Hybrid")}</option>
                        <option value="Distance">{t("Distance")}</option>
                        <option value="Regular">{t("Regular")}</option>
                        <option value="Virtual">{t("Virtual")}</option>
                        <option value="Other">{t("Other")}</option>
                      </select>
                      {formData.internshipMode === "Other" && (
                        <input
                          name="otherInternshipMode"
                          placeholder={t("Enter Internship Mode")}
                          className="w-full px-4 py-2 mt-2 rounded-none border border-primary/50 bg-background text-xs font-bold focus:border-primary focus:outline-none transition-all animate-in slide-in-from-top-1"
                          value={formData.otherInternshipMode}
                          onChange={handleChange}
                        />
                      )}
                    </div>

                    {selectedInternshipDetails && (
                      <div className="md:col-span-3">
                        <div className="bg-primary/5 border border-primary/20 p-4 space-y-4">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">{t("Internship Details")}</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{t("Duration")}:</p>
                              <p className="text-sm font-bold text-foreground">
                                {selectedInternshipDetails.duration_value && selectedInternshipDetails.duration_unit
                                  ? `${selectedInternshipDetails.duration_value} ${selectedInternshipDetails.duration_unit}`
                                  : selectedInternshipDetails.duration_months
                                    ? `${selectedInternshipDetails.duration_months} months`
                                    : "—"}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{t("Fee")}:</p>
                              <p className="text-sm font-bold text-foreground">
                                {selectedInternshipDetails.fees ? `₹${selectedInternshipDetails.fees}` : (selectedInternshipDetails.registration_fee ? `₹${selectedInternshipDetails.registration_fee}` : "—")}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

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
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("First Name")}</label>
                      <input name="firstName" placeholder={t("First Name")} className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all" value={formData.firstName} onChange={handleChange} />
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
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Mobile No")}</label>
                      <input name="phone" placeholder="+91 1234567890" className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all" value={formData.phone} onChange={handleChange} />
                    </div>
                    <div className="space-y-2 md:col-span-1">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Email ID")}</label>
                      <input name="email" type="email" className={cn(
                        "w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:outline-none transition-all",
                        emailExists ? "border-red-500 focus:border-red-500" : "focus:border-primary"
                      )} value={formData.email} onChange={handleChange} />
                      {checkingEmail && <p className="text-xs text-muted-foreground">Checking...</p>}
                      {emailExists && <p className="text-xs text-red-500">Email already exists</p>}
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
                          setSelectedCountry(e.target.value || null);
                          setCustomCountry("");
                          if (e.target.value !== "other") {
                            const country = countries.find(c => c.id === e.target.value);
                            setFormData({ ...formData, country: country?.name || "" });
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
                            setFormData({ ...formData, country: e.target.value });
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
                          setSelectedState(e.target.value || null);
                          setCustomState("");
                          if (e.target.value !== "other") {
                            const state = states.find(s => s.id === e.target.value);
                            setFormData({ ...formData, state: state?.name || "" });
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
                            setFormData({ ...formData, state: e.target.value });
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
                          setSelectedDistrict(e.target.value || null);
                          setCustomDistrict("");
                          if (e.target.value !== "other") {
                            const district = districts.find(d => d.id === e.target.value);
                            setFormData({ ...formData, district: district?.name || "" });
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
                            setFormData({ ...formData, district: e.target.value });
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
                          setSelectedCity(e.target.value || null);
                          setCustomCity("");
                          if (e.target.value !== "other") {
                            const city = cities.find(c => c.id === e.target.value);
                            setFormData({ ...formData, city: city?.name || "" });
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
                            setFormData({ ...formData, city: e.target.value });
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
                          setSelectedPincode(e.target.value || null);
                          setCustomPincode("");
                          if (e.target.value !== "other") {
                            const pincode = pincodes.find(p => p.id === e.target.value);
                            setFormData({ ...formData, pincode: pincode?.name || "" });
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
                            setFormData({ ...formData, pincode: e.target.value });
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

              <Card className="rounded-none border-border shadow-md overflow-hidden border-t-4 border-t-emerald-600">
                <CardHeader className="bg-muted/30 border-b border-border py-4">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-emerald-700 flex items-center gap-2">
                    <GraduationCap className="w-5 h-5" />
                    {t("Academic & Documents")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2 md:col-span-3">
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
                    <div className="space-y-2 md:col-span-3">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("College/University")}</label>
                      <select
                        name="college"
                        className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all"
                        value={formData.college}
                        onChange={handleChange}
                      >
                        <option value="">{t("Select College/University")}</option>
                        {colleges.map(college => (
                          <option key={college._id} value={college.name}>{college.name}</option>
                        ))}
                      </select>
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
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Intern Photo (Image)")}</label>
                      <div className="flex items-center border border-border bg-background overflow-hidden">
                        <label className="px-4 py-3 bg-muted border-r border-border cursor-pointer hover:bg-muted/80 text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all">
                          {t("Choose file")}
                          <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                        </label>
                        <span className="px-4 text-[10px] font-bold text-muted-foreground truncate">{formData.photoUrl ? formData.photoUrl.split('/').pop() : t("No file chosen")}</span>
                      </div>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Intern Signature (Image)")}</label>
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
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Login Email")}</label>
                      <input
                        name="email"
                        disabled
                        className="w-full px-4 py-3 rounded-none border border-border bg-muted/50 text-sm font-bold cursor-not-allowed"
                        value={formData.email}
                      />
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">
                        {t("Intern will use their email as login ID")}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Set Password")} <span className="text-muted-foreground">(leave blank to keep current)</span></label>
                      <div className="relative">
                        <input type="text" name="user_name_fake" style={{ display: 'none' }} tabIndex={-1} />
                        <input type="password" name="password_fake" style={{ display: 'none' }} tabIndex={-1} />

                        <input
                          name={passwordFieldName}
                          type={showPassword ? "text" : "password"}
                          className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all pr-12"
                          value={formData.password}
                          onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                          onFocus={(e) => e.target.removeAttribute('readonly')}
                          readOnly
                          autoComplete="new-password"
                          placeholder={t("Leave blank to keep current password")}
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
                {t("Review Update Details")}
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
              <h2 className="text-3xl font-black uppercase tracking-tight text-foreground">{t("Update Successful!")}</h2>
              <p className="text-muted-foreground font-bold uppercase tracking-wider text-xs">{t("Intern account has been updated successfully.")}</p>
            </div>
            <div className="flex flex-col w-full max-w-md gap-4 pt-6">
              <button
                onClick={() => navigate(-1)}
                className="w-full bg-primary text-white py-4 rounded-none font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-3"
              >
                <ArrowLeft className="w-4 h-4" />
                {t("Back to Intern List")}
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default EditInternPage;

