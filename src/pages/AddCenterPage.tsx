import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { School, User, Mail, Phone, MapPin, Building, Globe, Send, Loader2, Eye, EyeOff, FileText, Image as ImageIcon, Clock, Landmark, Laptop, Percent, BookOpen, Search, Save, Trash2, Download, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

type CenterDocRow = { name: string; number?: string; url?: string };

const toId = (v: unknown): string => {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "$oid" in (v as any)) return (v as any).$oid as string;
  return String(v || "");
};

const AddCenterPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Form, 2: Preview
  const [courses, setCourses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [submittedCenterId, setSubmittedCenterId] = useState<string | null>(null);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  // Location data and selection state
  const [countries, setCountries] = useState<{ id: string; name: string; code?: string }[]>([]);
  const [states, setStates] = useState<{ id: string; name: string }[]>([]);
  const [districts, setDistricts] = useState<{ id: string; name: string }[]>([]);
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [pincodes, setPincodes] = useState<{ id: string; name: string }[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedPincode, setSelectedPincode] = useState<string | null>(null);

  // "Other" inputs
  const [customCountry, setCustomCountry] = useState("");
  const [customState, setCustomState] = useState("");
  const [customDistrict, setCustomDistrict] = useState("");
  const [customCity, setCustomCity] = useState("");
  const [customPincode, setCustomPincode] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    owner_name: "",
    about_center: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    district: "",
    state: "",
    country: "India",
    maps_embed_url: "",
    pincode: "",
    password: "",
    center_code: "",
    discount_coupon: "",
    referral_code: "",
    // infra
    computers: 0,
    classrooms: 0,
    staff: 0,
    lab_type: "",
    internet_available: true,
    power_backup: false,
    // bank
    bank_name: "",
    account_number: "",
    ifsc_code: "",
    account_holder: "",
    branch_address: "",
    // config
    creation_date: "",
    validity_date: "",
    franchise_fee: 0,
    royalty_percent: 0,
    mock_test_enabled: true,
    mock_test_start_date: "",
    mock_test_end_date: "",
    // working hours
    opening_time: "",
    closing_time: "",
  });
  const [keyDocs, setKeyDocs] = useState({
    auth_letter_url: "",
    owner_photo_url: "",
    owner_signature_url: "",
    center_stamp_url: "",
  });
  const [branding, setBranding] = useState({
    center_logo_url: "",
    banner_image_url: "",
    gallery_urls: [] as string[],
    qr_code_1_url: "",
    qr_code_2_url: "",
    short_clip_urls: [] as string[],
  });
  const [documents, setDocuments] = useState<CenterDocRow[]>([
    { name: "Government ID", number: "", url: "" },
  ]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [courseSearchQuery, setCourseSearchQuery] = useState("");
  const [workingDays, setWorkingDays] = useState<string[]>(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  const [showPwd, setShowPwd] = useState(false);
  const [centerCodeStatus, setCenterCodeStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [discountApplied, setDiscountApplied] = useState(false);
  const [referralApplied, setReferralApplied] = useState(false);
  const [selectedDrafts, setSelectedDrafts] = useState<string[]>([]);

  useEffect(() => {
    const fetchCourses = async () => {
      setCoursesLoading(true);
      try {
        const res = await apiFetch("/api/courses");
        if (res.ok) {
          const data = await res.json();
          setCourses(data);
        }
      } catch (error) {
        console.error("Failed to fetch courses:", error);
      } finally {
        setCoursesLoading(false);
      }
    };

    const fetchCategories = async () => {
      setCategoriesLoading(true);
      try {
        const res = await apiFetch("/api/admin/categories");
        if (res.ok) {
          const data = await res.json();
          setCategories(data.items || []);
        }
      } catch (error) {
        console.error("Failed to fetch categories:", error);
      } finally {
        setCategoriesLoading(false);
      }
    };

    const fetchCountries = async () => {
      try {
        const res = await apiFetch("/api/public/locations/countries");
        if (res.ok) {
          const data = await res.json();
          setCountries(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error("Failed to fetch countries:", error);
      }
    };

    const fetchDrafts = async () => {
      try {
        const res = await apiFetch("/api/centers/drafts");
        if (res.ok) {
          const data = await res.json();
          setDrafts(data);
        }
      } catch (error) {
        console.error("Failed to fetch drafts:", error);
      }
    };

    fetchCourses();
    fetchCategories();
    fetchCountries();
    fetchDrafts();
  }, []);

  // Fetch states when country changes
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
    setSelectedState(null);
    setDistricts([]);
    setCities([]);
    setPincodes([]);
  }, [selectedCountry]);

  // Fetch districts when state changes
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
    setSelectedDistrict(null);
    setCities([]);
    setPincodes([]);
  }, [selectedState]);

  // Fetch cities when district changes
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
    setSelectedCity(null);
    setPincodes([]);
  }, [selectedDistrict]);

  // Fetch pincodes when city changes
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
    setSelectedPincode(null);
  }, [selectedCity]);

  // Real-time center code validation
  useEffect(() => {
    const validateCenterCode = async () => {
      if (!formData.center_code) {
        setCenterCodeStatus("idle");
        return;
      }
      setCenterCodeStatus("checking");
      try {
        const res = await apiFetch(`/api/centers/check-code?code=${encodeURIComponent(formData.center_code)}`);
        if (res.ok) {
          const data = await res.json();
          setCenterCodeStatus(data.exists ? "taken" : "available");
        } else {
          setCenterCodeStatus("idle");
        }
      } catch {
        setCenterCodeStatus("idle");
      }
    };
    const timer = setTimeout(validateCenterCode, 500);
    return () => clearTimeout(timer);
  }, [formData.center_code]);

  // Auto-save logic
  useEffect(() => {
    const timer = setTimeout(() => {
      if (step === 1 && (formData.name || formData.email || selectedCourses.length > 0)) {
        saveDraft(true);
      }
    }, 5000); // Auto-save every 5 seconds if there's data
    return () => clearTimeout(timer);
  }, [formData, selectedCourses, selectedCategories, keyDocs, branding, documents]);

  const saveDraft = async (isAuto = false) => {
    try {
      const draftData = {
        formData,
        selectedCourses,
        keyDocs,
        branding,
        documents,
        selectedCategories
      };

      const res = await apiFetch("/api/centers/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: currentDraftId,
          name: formData.name || `Draft ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
          data: draftData
        })
      });

      if (res.ok) {
        const result = await res.json();
        if (result.draft_id) {
          setCurrentDraftId(result.draft_id);
        }
        setLastSaved(new Date());

        // Refresh drafts list so user sees their new/updated draft
        const draftsRes = await apiFetch("/api/centers/drafts");
        if (draftsRes.ok) {
          const data = await draftsRes.json();
          setDrafts(data);
        }

        if (!isAuto) {
          toast.success("Draft saved successfully");
        }
      }
    } catch (error) {
      if (!isAuto) toast.error("Failed to save draft");
    }
  };

  const loadDraft = async (draftId: string) => {
    try {
      const res = await apiFetch(`/api/centers/drafts/${draftId}`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setCurrentDraftId(draftId);
          setFormData(data.formData || formData);
          setSelectedCourses(data.selectedCourses || []);
          setKeyDocs(data.keyDocs || keyDocs);
          setBranding(data.branding || branding);
          setDocuments(data.documents || documents);
          setSelectedCategories(data.selectedCategories || []);
          setShowDrafts(false);
          toast.success("Draft loaded");
        }
      }
    } catch (error) {
      toast.error("Failed to load draft");
    }
  };

  const deleteDraft = async (draftId: string) => {
    try {
      const res = await apiFetch(`/api/centers/drafts/${draftId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        if (currentDraftId === draftId) {
          setCurrentDraftId(null);
        }
        setDrafts(prev => prev.filter(d => d.id !== draftId));
        toast.success("Draft deleted");
      }
    } catch (error) {
      toast.error("Failed to delete draft");
    }
  };

  const applyDiscountCoupon = async () => {
    if (!formData.discount_coupon) return;
    try {
      const res = await apiFetch(`/api/coupons/validate?code=${encodeURIComponent(formData.discount_coupon)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.valid) {
          setDiscountApplied(true);
          toast.success("Discount coupon applied successfully!");
        } else {
          toast.error(data.message || "Invalid discount coupon");
        }
      } else {
        toast.error("Failed to validate discount coupon");
      }
    } catch {
      toast.error("Error validating discount coupon");
    }
  };

  const applyReferralCode = async () => {
    if (!formData.referral_code) return;
    try {
      const res = await apiFetch("/api/referrals/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: formData.referral_code })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.valid) {
          setReferralApplied(true);
          toast.success("Referral code applied successfully!");
        } else {
          toast.error(data.message || "Invalid referral code");
        }
      } else {
        toast.error("Failed to validate referral code");
      }
    } catch {
      toast.error("Error validating referral code");
    }
  };

  const handleDownloadPDF = () => {
    if (submittedCenterId) {
      window.open(`/api/centers/${submittedCenterId}/print`, "_blank");
    }
  };

  const courseOptions = useMemo(
    () => courses.map(c => c.course_name),
    [courses]
  );

  const normalizeMapUrl = (value: string) => {
    const v = (value || "").trim();
    if (!v) return "";
    // If someone pastes full iframe markup, extract src="...".
    if (v.includes("<iframe") || v.includes("</iframe>")) {
      const match = v.match(/src\s*=\s*["']([^"']+)["']/i);
      const url = match?.[1]?.trim() || "";
      // Only return if it's a valid google maps embed url
      if (url.includes("google.com/maps/embed") || url.includes("google.co.in/maps/embed")) {
        return url;
      }
      return ""; // Not a valid map embed URL
    }
    return v;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const confirmSubmit = async () => {
    setLoading(true);
    try {

      const payload = {
        name: formData.name,
        owner_name: formData.owner_name,
        about_center: formData.about_center || undefined,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        city: formData.city,
        district: formData.district || undefined,
        state: formData.state,
        center_code: formData.center_code || undefined,
        discount_coupon: formData.discount_coupon || undefined,
        referral_code: formData.referral_code || undefined,
        username: formData.email, // Email used as username (as requested)
        password: formData.password,

        country: formData.country || undefined,
        maps_embed_url: normalizeMapUrl(formData.maps_embed_url) || undefined,
        pincode: formData.pincode || undefined,

        computers: Number.isFinite(formData.computers) ? Number(formData.computers) : undefined,
        classrooms: Number.isFinite(formData.classrooms) ? Number(formData.classrooms) : undefined,
        staff: Number.isFinite(formData.staff) ? Number(formData.staff) : undefined,
        lab_type: formData.lab_type || undefined,
        internet_available: !!formData.internet_available,
        power_backup: !!formData.power_backup,

        course_allotment: selectedCourses,

        bank_name: formData.bank_name || undefined,
        account_number: formData.account_number || undefined,
        ifsc_code: formData.ifsc_code || undefined,
        account_holder: formData.account_holder || undefined,
        branch_address: formData.branch_address || undefined,

        documents: documents
          .map((d) => ({ name: d.name.trim(), number: d.number?.trim() || undefined, url: d.url?.trim() || undefined }))
          .filter((d) => d.name.length > 0),

        creation_date: formData.creation_date || undefined,
        validity_date: formData.validity_date || undefined,
        franchise_fee: Number.isFinite(formData.franchise_fee) ? Number(formData.franchise_fee) : undefined,
        royalty_percent: Number.isFinite(formData.royalty_percent) ? Number(formData.royalty_percent) : undefined,
        mock_test_enabled: !!formData.mock_test_enabled,
        mock_test_start_date: formData.mock_test_start_date || undefined,
        mock_test_end_date: formData.mock_test_end_date || undefined,

        auth_letter_url: keyDocs.auth_letter_url || undefined,
        owner_photo_url: keyDocs.owner_photo_url || undefined,
        owner_signature_url: keyDocs.owner_signature_url || undefined,
        center_stamp_url: keyDocs.center_stamp_url || undefined,

        center_logo_url: branding.center_logo_url || undefined,
        banner_image_url: branding.banner_image_url || undefined,
        gallery_urls: branding.gallery_urls || [],
        qr_code_1_url: branding.qr_code_1_url || undefined,
        qr_code_2_url: branding.qr_code_2_url || undefined,
        short_clip_urls: branding.short_clip_urls || [],

        opening_time: formData.opening_time || undefined,
        closing_time: formData.closing_time || undefined,
        working_days: workingDays,
      };
      const response = await apiFetch("/api/centers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Server returned non-JSON response:", text);
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(data.message);
        const centerIdRaw = data && (data.center_id || data.centerId || data.center?._id || data._id || data.id);
        const idToUse: string | null = centerIdRaw ? toId(centerIdRaw) : null;
        if (idToUse) {
          setSubmittedCenterId(idToUse);
          // Delete draft if it exists
          if (currentDraftId) {
            deleteDraft(currentDraftId);
            setCurrentDraftId(null);
          }
        }

        try {
          // Sync Key Documents (owner signature, center stamp) to center_assets for certificates
          if (idToUse && (keyDocs.owner_signature_url || keyDocs.center_stamp_url)) {
            await apiFetch("/api/center/assets", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                center_id: idToUse,
                signature_url: keyDocs.owner_signature_url || undefined,
                stamp_url: keyDocs.center_stamp_url || undefined,
              }),
            });
          }
        } catch {
          // ignore asset save errors, center already created
        }

        setFormData({
          name: "",
          owner_name: "",
          about_center: "",
          phone: "",
          email: "",
          address: "",
          city: "",
          district: "",
          state: "",
          country: "India",
          maps_embed_url: "",
          pincode: "",
          password: "",
          center_code: "",
          discount_coupon: "",
          referral_code: "",
          computers: 0,
          classrooms: 0,
          staff: 0,
          lab_type: "",
          internet_available: true,
          power_backup: false,
          bank_name: "",
          account_number: "",
          ifsc_code: "",
          account_holder: "",
          branch_address: "",
          creation_date: "",
          validity_date: "",
          franchise_fee: 0,
          royalty_percent: 0,
          mock_test_enabled: true,
          mock_test_start_date: "",
          mock_test_end_date: "",
          opening_time: "",
          closing_time: "",
        });
        setKeyDocs({ auth_letter_url: "", owner_photo_url: "", owner_signature_url: "", center_stamp_url: "" });
        setBranding({ center_logo_url: "", banner_image_url: "", gallery_urls: [], qr_code_1_url: "", qr_code_2_url: "", short_clip_urls: [] });
        setDocuments([{ name: "Government ID", number: "", url: "" }]);
        setSelectedCourses([]);
        setWorkingDays(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
        setStep(1);
      } else {
        toast.error(data.message || "Failed to create center");
      }
    } catch (error) {
      console.error("Error creating center:", error);
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const PreviewView = () => (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="bg-primary/5 border border-primary/20 p-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-primary">{t("Preview Center Details")}</h2>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("Please review all information before final submission.")}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="rounded-none font-black uppercase tracking-widest text-[10px]" onClick={() => setStep(1)}>
            {t("Edit Details")}
          </Button>
          <Button className="rounded-none font-black uppercase tracking-widest text-[10px]" onClick={confirmSubmit} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            {t("Confirm & Submit")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="rounded-none border-border shadow-sm">
          <CardHeader className="bg-muted/30 border-b border-border py-3 px-4">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest">{t("Basic Info")}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 text-[11px]">
              <span className="font-black text-muted-foreground uppercase">{t("Center Name")}:</span>
              <span className="font-bold uppercase">{formData.name}</span>
            </div>
            <div className="grid grid-cols-2 text-[11px]">
              <span className="font-black text-muted-foreground uppercase">{t("Owner Name")}:</span>
              <span className="font-bold uppercase">{formData.owner_name}</span>
            </div>
            <div className="grid grid-cols-2 text-[11px]">
              <span className="font-black text-muted-foreground uppercase">{t("Phone")}:</span>
              <span className="font-bold">{formData.phone}</span>
            </div>
            <div className="grid grid-cols-2 text-[11px]">
              <span className="font-black text-muted-foreground uppercase">{t("Email")}:</span>
              <span className="font-bold">{formData.email}</span>
            </div>
            {formData.center_code && (
              <div className="grid grid-cols-2 text-[11px]">
                <span className="font-black text-muted-foreground uppercase">{t("Center Code")}:</span>
                <span className="font-bold uppercase">{formData.center_code}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-none border-border shadow-sm">
          <CardHeader className="bg-muted/30 border-b border-border py-3 px-4">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest">{t("Location")}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 text-[11px]">
              <span className="font-black text-muted-foreground uppercase">{t("Country")}:</span>
              <span className="font-bold uppercase">{formData.country}</span>
            </div>
            <div className="grid grid-cols-2 text-[11px]">
              <span className="font-black text-muted-foreground uppercase">{t("State")}:</span>
              <span className="font-bold uppercase">{formData.state}</span>
            </div>
            {formData.district && (
              <div className="grid grid-cols-2 text-[11px]">
                <span className="font-black text-muted-foreground uppercase">{t("District")}:</span>
                <span className="font-bold uppercase">{formData.district}</span>
              </div>
            )}
            <div className="grid grid-cols-2 text-[11px]">
              <span className="font-black text-muted-foreground uppercase">{t("City")}:</span>
              <span className="font-bold uppercase">{formData.city}</span>
            </div>
            <div className="grid grid-cols-2 text-[11px]">
              <span className="font-black text-muted-foreground uppercase">{t("Pincode")}:</span>
              <span className="font-bold uppercase">{formData.pincode}</span>
            </div>
            <div className="grid grid-cols-2 text-[11px]">
              <span className="font-black text-muted-foreground uppercase">{t("Full Address")}:</span>
              <span className="font-bold uppercase">{formData.address}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-border shadow-sm">
          <CardHeader className="bg-muted/30 border-b border-border py-3 px-4">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest">{t("Config & Fees")}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 text-[11px]">
              <span className="font-black text-muted-foreground uppercase">{t("Franchise Fee")}:</span>
              <span className="font-bold">₹{formData.franchise_fee}</span>
            </div>
            <div className="grid grid-cols-2 text-[11px]">
              <span className="font-black text-muted-foreground uppercase">{t("Royalty")}:</span>
              <span className="font-bold">{formData.royalty_percent}%</span>
            </div>
            {formData.discount_coupon && (
              <div className="grid grid-cols-2 text-[11px]">
                <span className="font-black text-muted-foreground uppercase">{t("Discount Coupon")}:</span>
                <span className="font-bold uppercase">{formData.discount_coupon}</span>
              </div>
            )}
            {formData.referral_code && (
              <div className="grid grid-cols-2 text-[11px]">
                <span className="font-black text-muted-foreground uppercase">{t("Referral Code")}:</span>
                <span className="font-bold uppercase">{formData.referral_code}</span>
              </div>
            )}
            <div className="grid grid-cols-2 text-[11px]">
              <span className="font-black text-muted-foreground uppercase">{t("Validity Until")}:</span>
              <span className="font-bold uppercase">{formData.validity_date}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-border shadow-sm">
          <CardHeader className="bg-muted/30 border-b border-border py-3 px-4">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest">{t("Infrastructure")}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 text-[11px]">
              <span className="font-black text-muted-foreground uppercase">{t("Computers")}:</span>
              <span className="font-bold">{formData.computers}</span>
            </div>
            <div className="grid grid-cols-2 text-[11px]">
              <span className="font-black text-muted-foreground uppercase">{t("Classrooms")}:</span>
              <span className="font-bold">{formData.classrooms}</span>
            </div>
            <div className="grid grid-cols-2 text-[11px]">
              <span className="font-black text-muted-foreground uppercase">{t("Staff")}:</span>
              <span className="font-bold">{formData.staff}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-border shadow-sm md:col-span-2">
          <CardHeader className="bg-muted/30 border-b border-border py-3 px-4">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest">{t("Allotted Courses")}</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              {selectedCourses.map(c => (
                <span key={c} className="px-2 py-1 bg-primary/10 border border-primary/20 text-[9px] font-black uppercase tracking-widest text-primary">
                  {c}
                </span>
              ))}
              {selectedCourses.length === 0 && <p className="text-[10px] italic text-muted-foreground">{t("No courses selected")}</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-border">
        <Button variant="outline" className="rounded-none font-black uppercase tracking-widest text-xs h-12 px-8" onClick={() => setStep(1)}>
          {t("Back to Edit")}
        </Button>
        <Button className="rounded-none font-black uppercase tracking-widest text-xs h-12 px-12" onClick={confirmSubmit} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
          {t("Final Submit")}
        </Button>
      </div>
    </div>
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    if (type === "number") {
      const num = value === "" ? 0 : Number(value);
      setFormData({ ...formData, [name]: num });
      return;
    }
    setFormData({ ...formData, [name]: value });
  };

  const numVal = (n: number) => (n === 0 ? "" : n);

  const uploadRaw = async (file: File): Promise<string | null> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await apiFetch("/api/uploads", { method: "POST", body: fd });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.url) return data.url as string;
    return null;
  };

  const uploadFile = async (field: string, file: File) => {
    setUploadingField(field);
    try {
      const url = await uploadRaw(file);
      if (url) {
        if (field in keyDocs) {
          setKeyDocs((prev) => ({ ...prev, [field]: url }));
        } else if (field === "gallery_urls") {
          setBranding((prev) => ({ ...prev, gallery_urls: [...prev.gallery_urls, url] }));
        } else if (field === "short_clip_urls") {
          setBranding((prev) => ({ ...prev, short_clip_urls: [...prev.short_clip_urls, url] }));
        } else {
          setBranding((prev) => ({ ...prev, [field]: url }));
        }
        toast.success("File uploaded");
      } else {
        toast.error("Upload failed");
      }
    } catch {
      toast.error("Upload error");
    } finally {
      setUploadingField(null);
    }
  };

  const uploadDocumentRow = async (idx: number, file: File) => {
    const field = `doc_${idx}`;
    setUploadingField(field);
    try {
      const url = await uploadRaw(file);
      if (!url) {
        toast.error("Upload failed");
        return;
      }
      setDocuments((prev) => prev.map((r, i) => (i === idx ? { ...r, url } : r)));
      toast.success("File uploaded");
    } catch {
      toast.error("Upload error");
    } finally {
      setUploadingField(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">{step === 1 ? t("Add New Center") : t("Confirm Center Details")}</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">{step === 1 ? t("Create a new regional center and its administrative account.") : t("Review the information below and confirm to create the center.")}</p>
          </div>
          <div className="flex items-center gap-2">
            {step === 1 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-none border-primary text-primary hover:bg-primary/5 font-black uppercase tracking-widest text-[10px]"
                  onClick={() => setShowDrafts(!showDrafts)}
                >
                  <FileText className="w-3 h-3 mr-2" />
                  {t("Drafts")} ({drafts.length})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-none border-border font-black uppercase tracking-widest text-[10px]"
                  onClick={() => saveDraft(false)}
                >
                  <Save className="w-3 h-3 mr-2" />
                  {t("Save Draft")}
                </Button>
              </>
            )}
            {submittedCenterId && (
              <Button
                variant="default"
                size="sm"
                className="rounded-none font-black uppercase tracking-widest text-[10px]"
                onClick={handleDownloadPDF}
              >
                <Download className="w-3 h-3 mr-2" />
                {t("Download Form PDF")}
              </Button>
            )}
          </div>
        </div>

        {showDrafts && (
          <Card className="rounded-none border-primary/30 shadow-lg bg-primary/5">
            <CardHeader className="py-3 border-b border-primary/10">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-between">
                <span>{t("Saved Drafts")}</span>
                <div className="flex items-center gap-3">
                  {selectedDrafts.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-3 text-destructive border-destructive hover:bg-destructive/10 text-[9px] font-black uppercase tracking-widest"
                      onClick={async () => {
                        for (const id of selectedDrafts) {
                          await deleteDraft(id);
                        }
                        setSelectedDrafts([]);
                      }}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      {t("Delete Selected")}
                    </Button>
                  )}
                  <button onClick={() => setShowDrafts(false)} className="text-muted-foreground hover:text-foreground">×</button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {drafts.length === 0 ? (
                <div className="p-4 text-center text-xs italic text-muted-foreground uppercase tracking-widest font-bold">
                  {t("No saved drafts found")}
                </div>
              ) : (
                <div className="divide-y divide-primary/10">
                  <div className="p-3 flex items-center gap-3 hover:bg-primary/10 transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedDrafts.length === drafts.length && drafts.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDrafts(drafts.map(d => d.id));
                        } else {
                          setSelectedDrafts([]);
                        }
                      }}
                      className="w-4 h-4 text-primary border-border focus:ring-primary"
                    />
                    <span className="text-xs font-bold uppercase">{t("Select All")}</span>
                  </div>
                  {drafts.map((d) => (
                    <div key={d.id} className="p-3 flex items-center gap-3 hover:bg-primary/10 transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedDrafts.includes(d.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedDrafts(prev => [...prev, d.id]);
                          } else {
                            setSelectedDrafts(prev => prev.filter(id => id !== d.id));
                          }
                        }}
                        className="w-4 h-4 text-primary border-border focus:ring-primary"
                      />
                      <div className="flex-1">
                        <div className="text-xs font-bold uppercase">{d.name}</div>
                        <div className="text-[9px] text-muted-foreground font-medium">{new Date(d.updated_at).toLocaleString()}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-[9px] font-black uppercase tracking-widest" onClick={() => loadDraft(d.id)}>
                          {t("Load")}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive text-[9px] font-black uppercase tracking-widest" onClick={() => deleteDraft(d.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {lastSaved && (
          <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground text-right italic">
            {t("Last auto-saved at")}: {lastSaved.toLocaleTimeString()}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Center Details Section */}
            <Card className="rounded-none border-border shadow-md overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border py-4">
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <School className="w-4 h-4 text-primary" />
                  {t("Center Information")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Center Name")}</label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input name="name" required placeholder={t("Full Center Name")} spellCheck={true} lang="en" className="w-full pl-10 pr-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all" value={formData.name} onChange={handleChange} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Owner / Manager Name")}</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input name="owner_name" required placeholder={t("Full Name")} spellCheck={true} lang="en" className="w-full pl-10 pr-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all" value={formData.owner_name} onChange={handleChange} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Phone Number")}</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input name="phone" required placeholder="+91 00000 00000" className="w-full pl-10 pr-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all" value={formData.phone} onChange={handleChange} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Email Address")}</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input name="email" type="email" required placeholder="center@example.com" autoComplete="off" className="w-full pl-10 pr-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all" value={formData.email} onChange={handleChange} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Center Code (Optional)")}</label>
                  <div className="relative">
                    <input name="center_code" placeholder={t("Enter custom center code, leave blank for auto-generated")} spellCheck={true} lang="en" className={cn("w-full px-4 py-2.5 rounded-none border bg-background text-sm focus:border-primary focus:outline-none transition-all", centerCodeStatus === "taken" ? "border-red-500" : centerCodeStatus === "available" ? "border-green-500" : "border-border")} value={formData.center_code} onChange={handleChange} />
                    {centerCodeStatus === "checking" && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />}
                    {centerCodeStatus === "available" && <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />}
                    {centerCodeStatus === "taken" && <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />}
                  </div>
                  {centerCodeStatus === "available" && <p className="text-xs text-green-600 font-medium ml-1">Center code available!</p>}
                  {centerCodeStatus === "taken" && <p className="text-xs text-red-600 font-medium ml-1">Center code already taken!</p>}
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("About Center")}</label>
                  <textarea
                    name="about_center"
                    rows={4}
                    spellCheck={true}
                    lang="en"
                    placeholder={t("Write a short overview about this center...")}
                    className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all resize-none"
                    value={formData.about_center}
                    onChange={handleChange}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Location Section */}
            <Card className="rounded-none border-border shadow-md overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border py-4">
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  {t("Location Details")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Country")}</label>
                  <select
                    className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
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
                    <option value="">-- {t("Select Country")} --</option>
                    <option value="other">-- {t("Other (Enter manually)")} --</option>
                    {countries.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {selectedCountry === "other" && (
                    <input
                      placeholder={t("Enter Country Name")}
                      className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all mt-2"
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
                    className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
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
                    <option value="">-- {t("Select State")} --</option>
                    <option value="other">-- {t("Other (Enter manually)")} --</option>
                    {states.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  {selectedState === "other" && (
                    <input
                      placeholder={t("Enter State Name")}
                      className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all mt-2"
                      value={customState}
                      onChange={(e) => {
                        setCustomState(e.target.value);
                        setFormData({ ...formData, state: e.target.value });
                      }}
                    />
                  )}
                  {selectedCountry === "other" && (
                    <input
                      name="state"
                      required
                      placeholder={t("State Name")}
                      spellCheck={true}
                      lang="en"
                      className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                      value={formData.state}
                      onChange={handleChange}
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("District")}</label>
                  <select
                    className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
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
                    <option value="">-- {t("Select District")} --</option>
                    <option value="other">-- {t("Other (Enter manually)")} --</option>
                    {districts.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  {selectedDistrict === "other" && (
                    <input
                      placeholder={t("Enter District Name")}
                      className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all mt-2"
                      value={customDistrict}
                      onChange={(e) => {
                        setCustomDistrict(e.target.value);
                        setFormData({ ...formData, district: e.target.value });
                      }}
                    />
                  )}
                  {selectedState === "other" && (
                    <input
                      name="district"
                      placeholder={t("District Name")}
                      spellCheck={true}
                      lang="en"
                      className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                      value={formData.district}
                      onChange={handleChange}
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("City")}</label>
                  <select
                    className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
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
                    <option value="">-- {t("Select City")} --</option>
                    <option value="other">-- {t("Other (Enter manually)")} --</option>
                    {cities.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {selectedCity === "other" && (
                    <input
                      placeholder={t("Enter City Name")}
                      className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all mt-2"
                      value={customCity}
                      onChange={(e) => {
                        setCustomCity(e.target.value);
                        setFormData({ ...formData, city: e.target.value });
                      }}
                    />
                  )}
                  {selectedDistrict === "other" && (
                    <input
                      name="city"
                      placeholder={t("City Name")}
                      spellCheck={true}
                      lang="en"
                      className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                      value={formData.city}
                      onChange={handleChange}
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Postal Code / Pincode")}</label>
                  <select
                    className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
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
                    <option value="">-- {t("Select Pincode")} --</option>
                    <option value="other">-- {t("Other (Enter manually)")} --</option>
                    {pincodes.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  {selectedPincode === "other" && (
                    <input
                      placeholder={t("Enter Pincode")}
                      className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all mt-2"
                      value={customPincode}
                      onChange={(e) => {
                        setCustomPincode(e.target.value);
                        setFormData({ ...formData, pincode: e.target.value });
                      }}
                    />
                  )}
                  {selectedCity === "other" && (
                    <input
                      name="pincode"
                      required
                      placeholder={t("6-digit Pincode")}
                      className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                      value={formData.pincode}
                      onChange={handleChange}
                    />
                  )}
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Full Address")}</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <textarea
                      name="address"
                      required
                      rows={3}
                      spellCheck={true}
                      lang="en"
                      placeholder={t("Building / House No, Street, Area, Landmark")}
                      className="w-full pl-10 pr-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all resize-none"
                      value={formData.address}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Google Maps Embed URL")}</label>
                  <input
                    name="maps_embed_url"
                    placeholder={t("Paste only the Google Maps embed URL (https://...)")}
                    className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                    value={formData.maps_embed_url}
                    onChange={(e) => setFormData({ ...formData, maps_embed_url: normalizeMapUrl(e.target.value) })}
                  />
                  {formData.maps_embed_url && !formData.maps_embed_url.includes("/maps/embed") && (
                    <p className="text-[10px] text-amber-600 font-bold mt-1 flex items-center gap-1">
                      <EyeOff className="w-3 h-3" />
                      {t("Warning: This doesn't look like an embed URL. Map preview may not work.")}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Infrastructure */}
            <Card className="rounded-none border-border shadow-md overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border py-4">
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-primary" />
                  {t("Infrastructure & Facilities")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("No. of Computers")}</label>
                  <input name="computers" type="number" min={0} className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm" value={numVal(formData.computers)} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("No. of Classrooms")}</label>
                  <input name="classrooms" type="number" min={0} className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm" value={numVal(formData.classrooms)} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("No. of Staff")}</label>
                  <input name="staff" type="number" min={0} className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm" value={numVal(formData.staff)} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Lab Type")}</label>
                  <input name="lab_type" placeholder={t("e.g. Modern")} spellCheck={true} lang="en" className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm" value={formData.lab_type} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Internet Availability")}</label>
                  <select
                    className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm"
                    value={formData.internet_available ? "Yes" : "No"}
                    onChange={(e) => setFormData({ ...formData, internet_available: e.target.value === "Yes" })}
                  >
                    <option value="Yes">{t("Yes")}</option>
                    <option value="No">{t("No")}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Power Backup")}</label>
                  <select
                    className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm"
                    value={formData.power_backup ? "Yes" : "No"}
                    onChange={(e) => setFormData({ ...formData, power_backup: e.target.value === "Yes" })}
                  >
                    <option value="Yes">{t("Yes")}</option>
                    <option value="No">{t("No")}</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Course Allotment */}
            <Card className="rounded-none border-border shadow-md overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <School className="w-4 h-4 text-primary" />
                  {t("Course Allotment")}
                </CardTitle>
                <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                  <div className="relative w-full md:w-48">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder={t("SEARCH COURSE...")}
                      className="w-full pl-7 pr-3 py-1.5 rounded-none border border-border bg-background text-[9px] font-black uppercase tracking-widest focus:border-primary focus:outline-none transition-all"
                      value={courseSearchQuery}
                      onChange={(e) => setCourseSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Category Multi-select */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1 flex items-center gap-2">
                      <BookOpen className="w-3 h-3 text-primary" />
                      {t("Select Course Categories")}
                    </label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[8px] font-black uppercase tracking-widest"
                        onClick={() => setSelectedCategories(categories.map(cat => cat.id))}
                      >
                        {t("Select All")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[8px] font-black uppercase tracking-widest"
                        onClick={() => setSelectedCategories([])}
                      >
                        {t("Clear")}
                      </Button>
                    </div>
                  </div>
                  {categoriesLoading ? (
                    <div className="flex items-center justify-center py-2">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto p-2 border border-border/50 bg-muted/10 custom-scrollbar">
                      {categories.map((cat) => {
                        const isCatSelected = selectedCategories.includes(cat.id);
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setSelectedCategories(prev =>
                                isCatSelected ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                              );
                            }}
                            className={cn(
                              "px-3 py-1.5 text-[9px] font-black uppercase tracking-wider border transition-all",
                              isCatSelected
                                ? "bg-primary border-primary text-primary-foreground"
                                : "bg-background border-border text-muted-foreground hover:border-primary/50"
                            )}
                          >
                            {cat.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Course Selection */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1 flex items-center gap-2">
                      <Laptop className="w-3 h-3 text-primary" />
                      {t("Select Courses")}
                    </label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[8px] font-black uppercase tracking-widest"
                        onClick={() => {
                          const filtered = courses.filter(c =>
                            (selectedCategories.length === 0 || selectedCategories.includes(toId(c.category_id))) &&
                            (c.course_name.toLowerCase().includes(courseSearchQuery.toLowerCase()) ||
                              c.course_code?.toLowerCase().includes(courseSearchQuery.toLowerCase()))
                          );
                          setSelectedCourses(prev => Array.from(new Set([...prev, ...filtered.map(c => c.course_name)])));
                        }}
                      >
                        {t("Select All Shown")}
                      </Button>
                    </div>
                  </div>
                  {coursesLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar border border-border/50 p-2 bg-muted/5">
                      {courses
                        .filter(c => {
                          const matchesSearch = c.course_name.toLowerCase().includes(courseSearchQuery.toLowerCase()) ||
                            c.course_code?.toLowerCase().includes(courseSearchQuery.toLowerCase());
                          const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(toId(c.category_id));
                          return matchesSearch && matchesCategory;
                        })
                        .map((c) => {
                          const isChecked = selectedCourses.includes(c.course_name);
                          return (
                            <label key={c.id || c._id} className={cn(
                              "flex items-center gap-3 border p-3 transition-all cursor-pointer hover:bg-muted/50",
                              isChecked ? "border-primary bg-primary/5" : "border-border bg-background"
                            )}>
                              <input
                                type="checkbox"
                                className="w-4 h-4 accent-primary"
                                checked={isChecked}
                                onChange={() => {
                                  setSelectedCourses((prev) =>
                                    isChecked ? prev.filter((x) => x !== c.course_name) : [...prev, c.course_name]
                                  );
                                }}
                              />
                              <div className="flex flex-col">
                                <span className="text-xs font-bold uppercase tracking-tight">{c.course_name}</span>
                                <div className="flex items-center gap-2">
                                  {c.course_code && (
                                    <span className="text-[9px] font-black text-muted-foreground tracking-widest uppercase">{c.course_code}</span>
                                  )}
                                  <span className="text-[8px] font-bold text-primary/70 uppercase">
                                    {categories.find(cat => cat.id === toId(c.category_id))?.name || ""}
                                  </span>
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      {courses.length === 0 && (
                        <div className="md:col-span-2 text-center py-4 text-xs text-muted-foreground italic">
                          {t("No courses available. Please create courses in the Academics section first.")}
                        </div>
                      )}
                      {courses.length > 0 && courses.filter(c => {
                        const matchesSearch = c.course_name.toLowerCase().includes(courseSearchQuery.toLowerCase()) ||
                          c.course_code?.toLowerCase().includes(courseSearchQuery.toLowerCase());
                        const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(toId(c.category_id));
                        return matchesSearch && matchesCategory;
                      }).length === 0 && (
                          <div className="md:col-span-2 text-center py-4 text-xs text-muted-foreground italic font-black uppercase tracking-widest">
                            {t("No matching courses found for selected filters")}
                          </div>
                        )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Bank Details */}
            <Card className="rounded-none border-border shadow-md overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border py-4">
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-primary" />
                  {t("Bank Details")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Bank Name")}</label>
                  <input name="bank_name" spellCheck={true} lang="en" className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm" value={formData.bank_name} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Account Number")}</label>
                  <input name="account_number" className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm" value={formData.account_number} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("IFSC Code")}</label>
                  <input name="ifsc_code" className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm" value={formData.ifsc_code} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Account Holder")}</label>
                  <input name="account_holder" spellCheck={true} lang="en" className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm" value={formData.account_holder} onChange={handleChange} />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Branch Address")}</label>
                  <input name="branch_address" spellCheck={true} lang="en" className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm" value={formData.branch_address} onChange={handleChange} />
                </div>
              </CardContent>
            </Card>

            {/* Center Documents */}
            <Card className="rounded-none border-border shadow-md overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border py-4">
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  {t("Center Documents")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {documents.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center border border-border p-3">
                    <div className="md:col-span-4">
                      <input
                        placeholder={t("Document Name e.g. Government ID")}
                        className="w-full px-3 py-2 border border-border bg-background text-sm"
                        value={row.name}
                        onChange={(e) => {
                          const v = e.target.value;
                          setDocuments((prev) => prev.map((r, i) => (i === idx ? { ...r, name: v } : r)));
                        }}
                      />
                    </div>
                    <div className="md:col-span-4">
                      <input
                        placeholder={t("Document Number (Optional)")}
                        className="w-full px-3 py-2 border border-border bg-background text-sm"
                        value={row.number || ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setDocuments((prev) => prev.map((r, i) => (i === idx ? { ...r, number: v } : r)));
                        }}
                      />
                    </div>
                    <div className="md:col-span-4 flex items-center justify-between gap-3">
                      <div className="text-xs text-muted-foreground truncate">{row.url || t("No file chosen")}</div>
                      <label className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1 cursor-pointer">
                        <span>{uploadingField === `doc_${idx}` ? t("Uploading...") : t("Upload")}</span>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            uploadDocumentRow(idx, file);
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        className="text-xs font-bold underline"
                        onClick={() => setDocuments((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        {t("Remove")}
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="border border-border px-4 py-2 text-xs font-black uppercase tracking-widest"
                    onClick={() => setDocuments((prev) => [...prev, { name: "", number: "", url: "" }])}
                  >
                    {t("Add Row")}
                  </button>
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("Upload is optional here; key documents below include required Auth Letter.")}
                </div>
              </CardContent>
            </Card>

            {/* Config & Validity */}
            <Card className="rounded-none border-border shadow-md overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border py-4">
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <Percent className="w-4 h-4 text-primary" />
                  {t("Config & Validity")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Creation Date")}</label>
                  <input name="creation_date" type="date" className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm" value={formData.creation_date} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Validity Date")}</label>
                  <input name="validity_date" type="date" className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm" value={formData.validity_date} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Franchise Fee")}</label>
                  <input name="franchise_fee" type="number" min={0} step="0.01" className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm" value={formData.franchise_fee === 0 ? "" : formData.franchise_fee} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Royalty (%)")}</label>
                  <input name="royalty_percent" type="number" min={0} step="0.01" className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm" value={formData.royalty_percent === 0 ? "" : formData.royalty_percent} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Discount Coupon (Optional)")}</label>
                  <div className="flex gap-2">
                    <input name="discount_coupon" placeholder={t("Enter discount coupon")} className="flex-1 px-4 py-2.5 rounded-none border border-border bg-background text-sm" value={formData.discount_coupon} onChange={handleChange} />
                    <Button variant="default" type="button" onClick={applyDiscountCoupon} disabled={!formData.discount_coupon} className="rounded-none whitespace-nowrap">
                      {discountApplied ? "Applied" : "Apply"}
                    </Button>
                  </div>
                  {discountApplied && <p className="text-xs text-green-600 font-medium ml-1">Discount coupon applied!</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Referral Code (Optional)")}</label>
                  <div className="flex gap-2">
                    <input name="referral_code" placeholder={t("Enter referral code")} className="flex-1 px-4 py-2.5 rounded-none border border-border bg-background text-sm" value={formData.referral_code} onChange={handleChange} />
                    <Button variant="default" type="button" onClick={applyReferralCode} disabled={!formData.referral_code} className="rounded-none whitespace-nowrap">
                      {referralApplied ? "Applied" : "Apply"}
                    </Button>
                  </div>
                  {referralApplied && <p className="text-xs text-green-600 font-medium ml-1">Referral code applied!</p>}
                </div>
                <div className="md:col-span-2 border-t border-border pt-6 mt-2">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <BookOpen className="w-3 h-3 text-primary" />
                    {t("Mock Test Subscription")}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Enable Mock Test")}</label>
                      <select
                        className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm"
                        value={formData.mock_test_enabled ? "Yes" : "No"}
                        onChange={(e) => setFormData({ ...formData, mock_test_enabled: e.target.value === "Yes" })}
                      >
                        <option value="Yes">{t("Yes (Enabled)")}</option>
                        <option value="No">{t("No (Disabled)")}</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Start Date")}</label>
                      <input
                        name="mock_test_start_date"
                        type="date"
                        className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm"
                        value={formData.mock_test_start_date}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("End Date (Expiry)")}</label>
                      <input
                        name="mock_test_end_date"
                        type="date"
                        className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm"
                        value={formData.mock_test_end_date}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Key Documents */}
            <Card className="rounded-none border-border shadow-md overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border py-4">
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  {t("Key Documents")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { key: "auth_letter_url", label: t("Auth Letter (PDF)"), accept: "application/pdf" },
                  { key: "owner_photo_url", label: t("Owner Photo"), accept: "image/*" },
                  { key: "owner_signature_url", label: t("Owner Signature"), accept: "image/*" },
                  { key: "center_stamp_url", label: t("Center Stamp"), accept: "image/*" },
                ].map((f) => (
                  <div key={f.key} className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1 flex items-center gap-2">
                      <FileText className="w-3 h-3" />
                      {f.label}
                    </label>
                    <div className="relative">
                      <input
                        placeholder={t("Uploaded file URL")}
                        className="w-full pr-24 px-4 py-2.5 rounded-none border border-border bg-background text-sm"
                        value={(keyDocs as any)[f.key] || ""}
                        onChange={(e) => setKeyDocs((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      />
                      <label className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 cursor-pointer">
                        <span>{uploadingField === f.key ? t("Uploading...") : t("Upload")}</span>
                        <input
                          type="file"
                          accept={f.accept}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadFile(f.key, file);
                          }}
                        />
                      </label>
                    </div>
                    {(keyDocs as any)[f.key] && (
                      <div className="mt-2 p-2 border border-border bg-muted/20">
                        {(keyDocs as any)[f.key].match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
                          <img src={(keyDocs as any)[f.key]} alt={f.label} className="h-20 object-contain mx-auto" />
                        ) : (
                          <a className="inline-block text-[10px] font-black uppercase tracking-widest underline" href={(keyDocs as any)[f.key]} target="_blank" rel="noreferrer">
                            {t("Open")} {f.label}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Branding & Media */}
            <Card className="rounded-none border-border shadow-md overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border py-4">
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-primary" />
                  {t("Branding & Media")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { key: "center_logo_url", label: t("Center Logo"), accept: "image/*" },
                  { key: "banner_image_url", label: t("Banner Image"), accept: "image/*" },
                  { key: "qr_code_1_url", label: t("QR Code 1"), accept: "image/*" },
                  { key: "qr_code_2_url", label: t("QR Code 2"), accept: "image/*" },
                ].map((f) => (
                  <div key={f.key} className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">{f.label}</label>
                    <div className="relative">
                      <input
                        placeholder={t("Uploaded file URL")}
                        className="w-full pr-24 px-4 py-2.5 rounded-none border border-border bg-background text-sm"
                        value={(branding as any)[f.key] || ""}
                        onChange={(e) => setBranding((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      />
                      <label className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 cursor-pointer">
                        <span>{uploadingField === f.key ? t("Uploading...") : t("Upload")}</span>
                        <input
                          type="file"
                          accept={f.accept}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadFile(f.key, file);
                          }}
                        />
                      </label>
                    </div>
                    {(branding as any)[f.key] && (
                      <div className="mt-2 p-2 border border-border bg-muted/20">
                        {(branding as any)[f.key].match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
                          <img src={(branding as any)[f.key]} alt={f.label} className="h-20 object-contain mx-auto" />
                        ) : (
                          <a className="inline-block text-[10px] font-black uppercase tracking-widest underline" href={(branding as any)[f.key]} target="_blank" rel="noreferrer">
                            {t("Open")} {f.label}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Short Clips (Multiple)")}</label>
                  <div className="flex items-center justify-between gap-3 border border-border p-3">
                    <div className="text-xs text-muted-foreground truncate">
                      {branding.short_clip_urls.length ? t("{{count}} file(s) uploaded", { count: branding.short_clip_urls.length }) : t("No file chosen")}
                    </div>
                    <label className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1 cursor-pointer">
                      <span>{uploadingField === "short_clip_urls" ? t("Uploading...") : t("Upload")}</span>
                      <input
                        type="file"
                        multiple
                        accept="video/*"
                        className="hidden"
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          for (const f of files) {
                            await uploadFile("short_clip_urls", f);
                          }
                        }}
                      />
                    </label>
                    {branding.short_clip_urls.length > 0 && (
                      <button
                        type="button"
                        className="text-xs font-bold underline"
                        onClick={() => setBranding((prev) => ({ ...prev, short_clip_urls: [] }))}
                      >
                        {t("Clear")}
                      </button>
                    )}
                  </div>
                  {branding.short_clip_urls.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                      {branding.short_clip_urls.map((url, idx) => (
                        <div key={`${url}-${idx}`} className="aspect-video border border-border bg-muted/20 relative group overflow-hidden">
                          <video src={url} className="w-full h-full object-cover" controls playsInline />
                          <button
                            type="button"
                            onClick={() => {
                              setBranding((prev) => ({
                                ...prev,
                                short_clip_urls: prev.short_clip_urls.filter((_, i) => i !== idx)
                              }));
                            }}
                            className="absolute top-2 right-2 bg-destructive text-destructive-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Gallery (Multiple)")}</label>
                  <div className="flex items-center justify-between gap-3 border border-border p-3">
                    <div className="text-xs text-muted-foreground truncate">
                      {branding.gallery_urls.length ? t("{{count}} file(s) uploaded", { count: branding.gallery_urls.length }) : t("No file chosen")}
                    </div>
                    <label className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1 cursor-pointer">
                      <span>{uploadingField === "gallery_urls" ? t("Uploading...") : t("Upload")}</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          for (const f of files) {
                            // sequential uploads to reuse existing endpoint
                            // eslint-disable-next-line no-await-in-loop
                            await uploadFile("gallery_urls", f);
                          }
                        }}
                      />
                    </label>
                    {branding.gallery_urls.length > 0 && (
                      <button
                        type="button"
                        className="text-xs font-bold underline"
                        onClick={() => setBranding((prev) => ({ ...prev, gallery_urls: [] }))}
                      >
                        {t("Clear")}
                      </button>
                    )}
                  </div>
                  {branding.gallery_urls.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                      {branding.gallery_urls.map((url, idx) => (
                        <div key={`${url}-${idx}`} className="aspect-square border border-border bg-muted/20 relative group overflow-hidden">
                          <img src={url} className="w-full h-full object-cover" alt={t("Gallery {{count}}", { count: idx + 1 })} />
                          <button
                            type="button"
                            className="absolute inset-0 bg-red-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-[10px] font-black uppercase"
                            onClick={() => setBranding(prev => ({ ...prev, gallery_urls: prev.gallery_urls.filter((_, i) => i !== idx) }))}
                          >
                            {t("Remove")}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Working Hours */}
            <Card className="rounded-none border-border shadow-md overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border py-4">
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  {t("Working Hours")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Opening Time")}</label>
                  <input name="opening_time" type="time" className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm" value={formData.opening_time} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Closing Time")}</label>
                  <input name="closing_time" type="time" className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm" value={formData.closing_time} onChange={handleChange} />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Working Days")}</label>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => {
                      const checked = workingDays.includes(d);
                      return (
                        <label key={d} className="flex items-center gap-2 border border-border px-3 py-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => setWorkingDays((prev) => (checked ? prev.filter((x) => x !== d) : [...prev, d]))}
                          />
                          {t(d)}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Account Section */}
            <Card className="rounded-none border-border shadow-md overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border py-4">
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  {t("Login Credentials")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Portal Username")}</label>
                  <input
                    disabled
                    placeholder={t("Will be used as username")}
                    className="w-full px-4 py-2.5 rounded-none border border-border bg-muted text-sm"
                    value={formData.email || ""}
                    readOnly
                  />
                  <div className="text-[10px] text-muted-foreground">{t("Email address will be used as the center login username.")}</div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Initial Password")}</label>
                  <div className="relative">
                    <input name="password" type={showPwd ? "text" : "password"} required placeholder="••••••••" autoComplete="new-password" className="w-full pl-4 pr-10 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all" value={formData.password} onChange={handleChange} />
                    <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors">
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end pt-4 pb-10">
              <button
                type="submit"
                disabled={loading}
                className="bg-primary text-primary-foreground px-10 py-4 rounded-none font-heading font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:opacity-90 transition-all flex items-center gap-3 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {t("Review & Preview")}
              </button>
            </div>
          </form>
        ) : (
          <PreviewView />
        )}
      </div>
    </DashboardLayout>
  );
};

export default AddCenterPage;
