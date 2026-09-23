import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { School, Search, ShieldCheck, ShieldAlert, MapPin, Phone, Filter, Loader2, Plus, Edit, Trash2, X, Save, FileText, Image as ImageIcon, Clock, Landmark, Laptop, EyeOff, BookOpen, CheckCircle, XCircle, Eye, CheckCircle2, Building, User, Mail, Globe, Percent } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const toId = (v: unknown): string => {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "$oid" in (v as any)) return (v as any).$oid as string;
  return String(v || "");
};

interface Center {
  _id: string;
  name: string;
  code: string;
  city: string;
  state: string;
  district?: string;
  center_code?: string;
  discount_coupon?: string;
  referral_code?: string;
  address: string;
  owner_name: string;
  about_center?: string;
  phone: string;
  email: string;
  active: boolean;
  location?: {
    country?: string;
    state?: string;
    district?: string;
    city?: string;
    address?: string;
    maps_embed_url?: string;
    pincode?: string;
  };
  infrastructure?: {
    computers?: number;
    classrooms?: number;
    staff?: number;
    lab_type?: string;
    internet_available?: boolean;
    power_backup?: boolean;
  };
  course_allotment?: string[];
  bank_details?: {
    bank_name?: string;
    account_number?: string;
    ifsc_code?: string;
    account_holder?: string;
    branch_address?: string;
  };
  documents?: { name: string; number?: string; url?: string }[];
  key_documents?: {
    auth_letter_url?: string;
    owner_photo_url?: string;
    owner_signature_url?: string;
    center_stamp_url?: string;
  };
  branding_media?: {
    center_logo_url?: string;
    banner_image_url?: string;
    gallery_urls?: string[];
    qr_code_1_url?: string;
    qr_code_2_url?: string;
    short_clip_url?: string;
    short_clip_urls?: string[];
  };
  working_hours?: {
    opening_time?: string;
    closing_time?: string;
    working_days?: string[];
  };
  config_validity?: {
    creation_date?: string;
    validity_date?: string;
    franchise_fee?: number;
    royalty_percent?: number;
    mock_test_enabled?: boolean;
    mock_test_start_date?: string;
    mock_test_end_date?: string;
  };
  password?: string;
  is_email_verified?: boolean;
  email_verified_at?: string;
}
const CenterListPage = () => {
  const { t } = useTranslation();
  const [centers, setCenters] = useState<Center[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [courseSearchQuery, setCourseSearchQuery] = useState("");
  const [editingCenter, setExpandedCenter] = useState<Center | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [assetsForm, setAssetsForm] = useState({ signature_url: "", stamp_url: "", background_url: "" });
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [assetsSaving, setAssetsSaving] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [centerCodeStatus, setCenterCodeStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [discountApplied, setDiscountApplied] = useState(false);
  const [referralApplied, setReferralApplied] = useState(false);

  // Location data for edit modal
  const [countries, setCountries] = useState<{ id: string; name: string; code?: string }[]>([]);
  const [states, setStates] = useState<{ id: string; name: string }[]>([]);
  const [districts, setDistricts] = useState<{ id: string; name: string }[]>([]);
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [pincodes, setPincodes] = useState<{ id: string; name: string }[]>([]);
  const [editSelectedCountry, setEditSelectedCountry] = useState<string | null>(null);
  const [editSelectedState, setEditSelectedState] = useState<string | null>(null);
  const [editSelectedDistrict, setEditSelectedDistrict] = useState<string | null>(null);
  const [editSelectedCity, setEditSelectedCity] = useState<string | null>(null);
  const [editSelectedPincode, setEditSelectedPincode] = useState<string | null>(null);
  const [editCustomCountry, setEditCustomCountry] = useState("");
  const [editCustomState, setEditCustomState] = useState("");
  const [editCustomDistrict, setEditCustomDistrict] = useState("");
  const [editCustomCity, setEditCustomCity] = useState("");
  const [editCustomPincode, setEditCustomPincode] = useState("");

  // Email OTP states for Edit mode
  const [otpSent, setOtpSent] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpValue, setOtpValue] = useState("");

  const fetchCenters = async () => {
    setLoading(true);
    setCategoriesLoading(true);
    setCoursesLoading(true);
    try {
      const [centersRes, coursesRes, categoriesRes, countriesRes] = await Promise.all([
        apiFetch("/api/centers"),
        apiFetch("/api/courses"),
        apiFetch("/api/admin/categories"),
        apiFetch("/api/public/locations/countries")
      ]);

      if (centersRes.ok) {
        const data = await centersRes.json();
        const list = Array.isArray(data) ? data : [];
        const normalized = list.map((c: any) => ({
          ...c,
          _id: c?.id, // because backend returns 'id'
          name: String(c?.name || ""),
          code: String(c?.code || ""),
          city: String(c?.city || ""),
          state: String(c?.state || ""),
        }));
        setCenters(normalized as Center[]);
      } else {
        const errorMsg = await centersRes.text().catch(() => "Unknown error");
        console.error("Failed to fetch centers:", centersRes.status, errorMsg);
        toast.error(t("Failed to load centers"));
      }

      if (coursesRes.ok) {
        const coursesData = await coursesRes.json();
        setCourses(Array.isArray(coursesData) ? coursesData : []);
      }

      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData.items || []);
      }

      if (countriesRes.ok) {
        const countriesData = await countriesRes.json();
        setCountries(Array.isArray(countriesData) ? countriesData : []);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast.error(t("An error occurred while loading data"));
    } finally {
      setLoading(false);
      setCategoriesLoading(false);
      setCoursesLoading(false);
    }
  };

  const sendOTP = async () => {
    if (!editingCenter?.email) return;
    setVerifyingOtp(true);
    try {
      const res = await apiFetch("/api/auth/send-email-otp", {
        method: "POST",
        body: JSON.stringify({ email: editingCenter.email })
      });
      if (res.ok) {
        setOtpSent(true);
        toast.success("OTP sent to center email");
      } else {
        toast.error("Failed to send OTP");
      }
    } catch {
      toast.error("Error sending OTP");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const verifyOTP = async (otp: string) => {
    if (!editingCenter?.email || !editingCenter?._id) return;
    setVerifyingOtp(true);
    try {
      const res = await apiFetch("/api/auth/verify-email-otp", {
        method: "POST",
        body: JSON.stringify({ email: editingCenter.email, otp })
      });
      if (res.ok) {
        // Mark as verified locally
        setExpandedCenter({ ...editingCenter, is_email_verified: true });
        setOtpSent(false);
        setOtpValue("");
        toast.success("Email verified successfully");
      } else {
        toast.error("Invalid OTP");
      }
    } catch {
      toast.error("Error verifying OTP");
    } finally {
      setVerifyingOtp(false);
    }
  };

  useEffect(() => {
    fetchCenters();
  }, [t]);

  // Initialize edit state when edit modal opens
  useEffect(() => {
    if (isEditModalOpen && editingCenter) {
      // Try to find country in list
      const countryName = editingCenter.location?.country || "";
      const country = countries.find(c => c.name === countryName);
      if (country) {
        setEditSelectedCountry(country.id);
      } else if (countryName) {
        setEditSelectedCountry("other");
        setEditCustomCountry(countryName);
      } else {
        setEditSelectedCountry(null);
      }
      // Reset state, district, city, pincode
      setEditSelectedState(null);
      setEditSelectedDistrict(null);
      setEditSelectedCity(null);
      setEditSelectedPincode(null);
      setEditCustomState("");
      setEditCustomDistrict("");
      setEditCustomCity("");
      setEditCustomPincode("");
      setStates([]);
      setDistricts([]);
      setCities([]);
      setPincodes([]);
    }
  }, [isEditModalOpen, editingCenter, countries]);

  // Fetch states when edit country changes
  useEffect(() => {
    if (editSelectedCountry && editSelectedCountry !== "other") {
      const fetchStates = async () => {
        try {
          const res = await apiFetch(`/api/public/locations/states?country_id=${encodeURIComponent(editSelectedCountry)}`);
          if (res.ok) {
            const data = await res.json();
            setStates(Array.isArray(data) ? data : []);

            // Try to find state in list if we have one
            if (editingCenter) {
              const stateName = editingCenter.state || "";
              const state = (Array.isArray(data) ? data : []).find(s => s.name === stateName);
              if (state) {
                setEditSelectedState(state.id);
              } else if (stateName) {
                setEditSelectedState("other");
                setEditCustomState(stateName);
              } else {
                setEditSelectedState(null);
              }
            }
          }
        } catch (error) {
          console.error("Failed to fetch states:", error);
        }
      };
      fetchStates();
    } else {
      setStates([]);
      setEditSelectedState(null);
      setEditCustomState("");
    }
  }, [editSelectedCountry, editingCenter]);

  // Fetch districts when edit state changes
  useEffect(() => {
    if (editSelectedState && editSelectedState !== "other") {
      const fetchDistricts = async () => {
        try {
          const res = await apiFetch(`/api/public/locations/districts?state_id=${encodeURIComponent(editSelectedState)}`);
          if (res.ok) {
            const data = await res.json();
            setDistricts(Array.isArray(data) ? data : []);

            // Try to find district in list if we have one
            if (editingCenter) {
              const districtName = editingCenter.location?.district || "";
              const district = (Array.isArray(data) ? data : []).find(d => d.name === districtName);
              if (district) {
                setEditSelectedDistrict(district.id);
              } else if (districtName) {
                setEditSelectedDistrict("other");
                setEditCustomDistrict(districtName);
              } else {
                setEditSelectedDistrict(null);
              }
            }
          }
        } catch (error) {
          console.error("Failed to fetch districts:", error);
        }
      };
      fetchDistricts();
    } else {
      setDistricts([]);
      setEditSelectedDistrict(null);
      setEditCustomDistrict("");
    }
  }, [editSelectedState, editingCenter]);

  // Fetch cities when edit district changes
  useEffect(() => {
    if (editSelectedDistrict && editSelectedDistrict !== "other") {
      const fetchCities = async () => {
        try {
          const res = await apiFetch(`/api/public/locations/cities?district_id=${encodeURIComponent(editSelectedDistrict)}`);
          if (res.ok) {
            const data = await res.json();
            setCities(Array.isArray(data) ? data : []);

            // Try to find city in list if we have one
            if (editingCenter) {
              const cityName = editingCenter.city || "";
              const city = (Array.isArray(data) ? data : []).find(c => c.name === cityName);
              if (city) {
                setEditSelectedCity(city.id);
              } else if (cityName) {
                setEditSelectedCity("other");
                setEditCustomCity(cityName);
              } else {
                setEditSelectedCity(null);
              }
            }
          }
        } catch (error) {
          console.error("Failed to fetch cities:", error);
        }
      };
      fetchCities();
    } else {
      setCities([]);
      setEditSelectedCity(null);
      setEditCustomCity("");
    }
  }, [editSelectedDistrict, editingCenter]);

  // Fetch pincodes when edit city changes
  useEffect(() => {
    if (editSelectedCity && editSelectedCity !== "other") {
      const fetchPincodes = async () => {
        try {
          const res = await apiFetch(`/api/public/locations/pincodes?city_id=${encodeURIComponent(editSelectedCity)}`);
          if (res.ok) {
            const data = await res.json();
            setPincodes(Array.isArray(data) ? data : []);

            // Try to find pincode in list if we have one
            if (editingCenter) {
              const pincodeName = editingCenter.location?.pincode || "";
              const pincode = (Array.isArray(data) ? data : []).find(p => p.name === pincodeName);
              if (pincode) {
                setEditSelectedPincode(pincode.id);
              } else if (pincodeName) {
                setEditSelectedPincode("other");
                setEditCustomPincode(pincodeName);
              } else {
                setEditSelectedPincode(null);
              }
            }
          }
        } catch (error) {
          console.error("Failed to fetch pincodes:", error);
        }
      };
      fetchPincodes();
    } else {
      setPincodes([]);
      setEditSelectedPincode(null);
      setEditCustomPincode("");
    }
  }, [editSelectedCity, editingCenter]);

  useEffect(() => {
    const loadAssets = async () => {
      if (!editingCenter || !isEditModalOpen) return;
      try {
        const params = new URLSearchParams({ center_id: toId(editingCenter._id) || "" });
        const res = await apiFetch(`/api/center/assets?${params.toString()}`);
        if (!res.ok) {
          const msg = await res.text().catch(() => "");
          toast.error(msg || t("Failed to load center assets"));
          return;
        }
        const data = await res.json().catch(() => null);
        if (data) {
          setAssetsForm({
            signature_url: data.signature_url || "",
            stamp_url: data.stamp_url || "",
            background_url: data.background_url || "",
          });
        } else {
          setAssetsForm({ signature_url: "", stamp_url: "", background_url: "" });
        }
      } catch (e) {
        toast.error(t("Failed to load center assets"));
      }
    };
    loadAssets();
  }, [editingCenter, isEditModalOpen, t]);

  const applyDiscountCoupon = async () => {
    if (!editingCenter?.discount_coupon) return;
    try {
      const res = await fetch(`/api/coupons/validate?code=${encodeURIComponent(editingCenter.discount_coupon)}`);
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
    if (!editingCenter?.referral_code) return;
    try {
      const res = await fetch("/api/referrals/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: editingCenter.referral_code })
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

  const handleDelete = async (id: string) => {
    if (!window.confirm(t("ARE YOU SURE YOU WANT TO MOVE THIS CENTER TO THE RECYCLE BIN? This will stop all systems, students, and user accounts for this center."))) return;

    setIsDeleting(true);
    try {
      const token = sessionStorage.getItem("token");
      const response = await fetch(`/api/centers/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast.success(t("Center moved to Recycle Bin"));
        fetchCenters();
      } else {
        toast.error(t("Failed to move center to bin"));
      }
    } catch (error) {
      toast.error(t("An error occurred"));
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePrint = async (id: string) => {
    setPrintingId(id);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`/api/centers/${id}/print`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        toast.error(t("Failed to generate PDF"));
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `center_details_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(t("An error occurred during printing"));
    } finally {
      setPrintingId(null);
    }
  };

  const handlePreview = async (id: string) => {
    setPreviewId(id);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`/api/centers/${id}/preview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        toast.error(t("Failed to load preview"));
        return;
      }
      const html = await res.text();
      setPreviewHtml(html);
    } catch (e) {
      toast.error(t("An error occurred during preview"));
    }
  };

  const toggleCenterStatus = async (id: string) => {
    setTogglingId(id);
    try {
      const res = await apiFetch(`/api/admin/centers/${id}/toggle-active`, {
        method: "POST"
      });
      if (res.ok) {
        toast.success(t("Status updated"));
        fetchCenters();
      } else {
        toast.error(t("Failed to update status"));
      }
    } catch (e) {
      toast.error(t("An error occurred"));
    } finally {
      setTogglingId(null);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = sessionStorage.getItem("token");
    try {
      if (!editingCenter) return;
      const locationPayload = {
        ...(editingCenter.location || {}),
        country: editingCenter.location?.country ?? "",
        district: editingCenter.location?.district ?? "",
        pincode: editingCenter.location?.pincode ?? "",
        maps_embed_url: editingCenter.location?.maps_embed_url ?? "",
      };
      const payload = {
        name: editingCenter.name,
        owner_name: editingCenter.owner_name,
        about_center: editingCenter.about_center || undefined,
        phone: editingCenter.phone,
        email: editingCenter.email,
        address: editingCenter.address,
        city: editingCenter.city,
        state: editingCenter.state,
        district: (editingCenter.location?.district || "").trim() || undefined,
        code: editingCenter.code?.trim() || editingCenter.center_code?.trim() || undefined,
        center_code: editingCenter.center_code?.trim() || undefined,
        discount_coupon: editingCenter.discount_coupon?.trim() || undefined,
        referral_code: editingCenter.referral_code?.trim() || undefined,
        active: editingCenter.active,
        location: locationPayload,
        infrastructure: editingCenter.infrastructure || undefined,
        course_allotment: editingCenter.course_allotment || undefined,
        bank_details: editingCenter.bank_details || undefined,
        documents: editingCenter.documents || undefined,
        key_documents: editingCenter.key_documents || undefined,
        branding_media: {
          ...editingCenter.branding_media,
          gallery_urls: editingCenter.branding_media?.gallery_urls?.filter(Boolean) || [],
          short_clip_urls: editingCenter.branding_media?.short_clip_urls?.filter(Boolean) || [],
        } || undefined,
        working_hours: editingCenter.working_hours || undefined,
        config_validity: editingCenter.config_validity || undefined,
        password: editingCenter.password || undefined,
        is_email_verified: editingCenter.is_email_verified,
      };
      const response = await fetch(`/api/centers/${editingCenter._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        toast.success(t("Center updated successfully"));
        setIsEditModalOpen(false);
        fetchCenters();
      } else {
        toast.error(t("Update failed"));
      }
    } catch (error) {
      toast.error(t("An error occurred"));
    }
  };

  const filteredCenters = (centers || []).filter(center => {
    const name = String(center?.name || "").toLowerCase();
    const code = String(center?.code || "").toLowerCase();
    const city = String(center?.city || "").toLowerCase();
    const query = (searchQuery || "").toLowerCase();
    return name.includes(query) || code.includes(query) || city.includes(query);
  });

  const validityText = (c: Center) => {
    const v = c.config_validity?.validity_date;
    if (!v) return "—";
    return v;
  };

  const uploadFile = async (field: "signature_url" | "stamp_url" | "background_url", file: File) => {
    setUploadingField(field);
    try {
      const token = sessionStorage.getItem("token");
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.url) {
        setAssetsForm(prev => ({ ...prev, [field]: data.url }));
        toast.success(t("File uploaded"));
      } else {
        toast.error(data?.message || t("Upload failed"));
      }
    } catch {
      toast.error(t("Upload error"));
    } finally {
      setUploadingField(null);
    }
  };

  const uploadRaw = async (file: File, fieldKey: string): Promise<string | null> => {
    setUploadingField(fieldKey);
    try {
      const token = sessionStorage.getItem("token");
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.url) {
        toast.success("File uploaded");
        return data.url as string;
      }
      toast.error(data?.message || "Upload failed");
      return null;
    } catch {
      toast.error("Upload error");
      return null;
    } finally {
      setUploadingField(null);
    }
  };

  const normalizeMapUrl = (value: string) => {
    const v = (value || "").trim();
    if (!v) return "";
    if (v.includes("<iframe") || v.includes("</iframe>")) {
      const match = v.match(/src\s*=\s*["']([^"']+)["']/i);
      return match?.[1]?.trim() || "";
    }
    return v;
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Center Management</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">View and manage all regional educational centers.</p>
          </div>
          <Link
            to="/dashboard/centers/add"
            className="bg-primary text-primary-foreground px-6 py-3 rounded-none font-heading font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:opacity-90 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Register New Center
          </Link>
        </div>

        {/* Search and Filter Bar */}
        <Card className="rounded-none border-border shadow-sm">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="SEARCH BY NAME, CODE OR CITY..."
                className="w-full pl-10 pr-4 py-2.5 rounded-none border border-border bg-muted/30 text-xs font-bold uppercase tracking-wider focus:border-primary focus:outline-none transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2.5 border border-border bg-card text-[10px] font-black uppercase tracking-[0.2em] hover:bg-muted transition-all" type="button">
              <Filter className="w-3.5 h-3.5" />
              Filter
            </button>
          </CardContent>
        </Card>

        {/* Centers Table */}
        <Card className="rounded-none border-border shadow-md overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border py-4">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <School className="w-4 h-4 text-primary" />
              Registered Centers ({filteredCenters.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-20 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Loading centers...</p>
              </div>
            ) : filteredCenters.length === 0 ? (
              <div className="p-20 text-center">
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">No centers found matching your search.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/10 text-muted-foreground uppercase text-[10px] font-black tracking-widest">
                      <th className="py-4 pl-6">Center Details</th>
                      <th className="py-4">Contact Person</th>
                      <th className="py-4">Location</th>
                      <th className="py-4 text-center">Status</th>
                      <th className="py-4 text-right pr-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="font-medium">
                    {filteredCenters.map((center) => (
                      <tr key={center._id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors group">
                        <td className="py-5 pl-6">
                          <div className="flex flex-col">
                            <span className="font-black text-foreground uppercase tracking-tight group-hover:text-primary transition-colors">{center.name}</span>
                            <span className="text-[10px] font-bold text-muted-foreground mt-0.5 uppercase tracking-[0.1em]">Code: {center.code}</span>
                          </div>
                        </td>
                        <td className="py-5">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-foreground uppercase">{center.owner_name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold">
                              <Phone className="w-3 h-3" /> {center.phone}
                            </div>
                          </div>
                        </td>
                        <td className="py-5">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase">
                              <MapPin className="w-3 h-3 text-primary" /> {(center.location?.country || "—")} / {(center.state || center.location?.state || "—")} / {(center.city || center.location?.city || "—")}
                            </div>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{center.address}</span>
                            <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
                              <span className="px-2 py-1 border border-border bg-muted/20">POSTAL: {center.location?.pincode || "—"}</span>
                              <span className="px-2 py-1 border border-border bg-muted/20">Valid: {validityText(center)}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-5">
                          <div className="flex items-center justify-center">
                            {center.active ? (
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/5 border border-green-500/20 text-green-500 rounded-none">
                                <ShieldCheck className="w-3 h-3" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Active</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/5 border border-red-500/20 text-red-500 rounded-none">
                                <ShieldAlert className="w-3 h-3" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Suspended</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-5 text-right pr-6">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handlePreview(center._id)}
                              className="p-2 border border-border hover:border-primary hover:text-primary transition-all rounded-none"
                              title="Preview Center Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handlePrint(center._id)}
                              disabled={printingId === center._id}
                              className="p-2 border border-border hover:border-primary hover:text-primary transition-all rounded-none disabled:opacity-50"
                              title="Print Center Details"
                            >
                              {printingId === center._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => toggleCenterStatus(center._id)}
                              disabled={togglingId === center._id}
                              className={cn(
                                "p-2 border border-border transition-all rounded-none",
                                center.active ? "hover:border-destructive hover:text-destructive" : "hover:border-emerald-500 hover:text-emerald-500"
                              )}
                              title={center.active ? t("Disable Center") : t("Enable Center")}
                            >
                              {togglingId === center._id ? <Loader2 className="w-4 h-4 animate-spin" /> : center.active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => {
                                const convertedCourseAllotment = (center.course_allotment || []).map(c => {
                                  const isObjectId = /^[0-9a-fA-F]{24}$/.test(c);
                                  if (!isObjectId) return c;
                                  const course = courses.find(course => (course._id || course.id) === c);
                                  return course?.course_name || c;
                                });
                                setExpandedCenter({ ...center, course_allotment: convertedCourseAllotment });
                                setDiscountApplied(false);
                                setReferralApplied(false);
                                setIsEditModalOpen(true);
                              }}
                              className="p-2 border border-border hover:border-primary hover:text-primary transition-all rounded-none"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(center._id)}
                              disabled={isDeleting}
                              className="p-2 border border-border hover:border-destructive hover:text-destructive transition-all rounded-none disabled:opacity-50"
                            >
                              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Modal */}
        {isEditModalOpen && editingCenter && (
          <div className="fixed inset-0 z-[10000] flex items-start justify-center p-4 pt-16 bg-background/80 backdrop-blur-sm">
            <Card className="relative w-full max-w-5xl bg-card rounded-none shadow-2xl border border-border overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border py-4 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <Edit className="w-4 h-4 text-primary" />
                  Center Details: {editingCenter.code}
                </CardTitle>
                <button onClick={() => setIsEditModalOpen(false)} className="p-1 hover:bg-muted transition-colors">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </CardHeader>
              <form onSubmit={handleUpdate}>
                <CardContent className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 max-h-[75vh] overflow-auto">
                  {/* Center Information */}
                  <Card className="lg:col-span-2 rounded-none border-border shadow-md overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b border-border py-4">
                      <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                        <School className="w-4 h-4 text-primary" />
                        Center Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">Center Name</label>
                        <div className="relative">
                          <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            spellCheck={true}
                            lang="en"
                            className="w-full pl-10 pr-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                            value={editingCenter.name}
                            onChange={(e) => setExpandedCenter({ ...editingCenter, name: e.target.value })}
                            placeholder="Full Center Name"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">Owner / Manager Name</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            spellCheck={true}
                            lang="en"
                            className="w-full pl-10 pr-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                            value={editingCenter.owner_name}
                            onChange={(e) => setExpandedCenter({ ...editingCenter, owner_name: e.target.value })}
                            placeholder="Full Name"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">Phone Number</label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            className="w-full pl-10 pr-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                            value={editingCenter.phone}
                            onChange={(e) => setExpandedCenter({ ...editingCenter, phone: e.target.value })}
                            placeholder="+91 00000 00000"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black uppercase tracking-widest ml-1">Email Address</label>
                          {editingCenter.is_email_verified ? (
                            <div className="flex items-center gap-1 text-green-600 text-[8px] font-black uppercase tracking-widest">
                              <CheckCircle2 className="w-3 h-3" />
                              Verified
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-amber-600 text-[8px] font-black uppercase tracking-widest">
                              <XCircle className="w-3 h-3" />
                              Not Verified
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                              className="w-full pl-10 pr-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                              value={editingCenter.email}
                              onChange={(e) => {
                                const newVal = e.target.value;
                                const originalCenter = centers.find(c => c._id === editingCenter._id);
                                setExpandedCenter({
                                  ...editingCenter,
                                  email: newVal,
                                  is_email_verified: newVal === originalCenter?.email ? originalCenter?.is_email_verified : false
                                });
                              }}
                              placeholder="center@example.com"
                            />
                          </div>
                          {!editingCenter.is_email_verified && !otpSent && (
                            <button
                              type="button"
                              onClick={sendOTP}
                              disabled={verifyingOtp || !editingCenter.email}
                              className="px-3 py-1 bg-primary text-primary-foreground text-[8px] font-black uppercase tracking-widest hover:opacity-90 disabled:opacity-50 rounded-none"
                            >
                              Verify with OTP
                            </button>
                          )}
                        </div>
                        {otpSent && !editingCenter.is_email_verified && (
                          <div className="mt-2 p-3 border border-primary/20 bg-primary/5 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="text-[9px] font-black uppercase tracking-widest text-primary ml-1">Enter 6-digit OTP</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                maxLength={6}
                                placeholder="000000"
                                className="w-32 px-4 py-2 border border-primary bg-background text-sm font-bold tracking-[0.5em] focus:outline-none rounded-none"
                                value={otpValue}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, "");
                                  setOtpValue(val);
                                  if (val.length === 6) verifyOTP(val);
                                }}
                              />
                              {verifyingOtp && <Loader2 className="w-4 h-4 animate-spin self-center" />}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">Center Code (Optional)</label>
                        <div className="relative">
                          <input
                            spellCheck={true}
                            lang="en"
                            className={cn("w-full px-4 py-2.5 rounded-none border bg-background text-sm focus:border-primary focus:outline-none transition-all", centerCodeStatus === "taken" ? "border-red-500" : centerCodeStatus === "available" ? "border-green-500" : "border-border")}
                            value={editingCenter.code || editingCenter.center_code || ""}
                            onChange={async (e) => {
                              const newCode = e.target.value;
                              setExpandedCenter({ ...editingCenter, code: newCode, center_code: newCode });
                              if (!newCode) {
                                setCenterCodeStatus("idle");
                                return;
                              }
                              setCenterCodeStatus("checking");
                              try {
                                const res = await apiFetch(`/api/centers/check-code?code=${encodeURIComponent(newCode)}`);
                                if (res.ok) {
                                  const data = await res.json();
                                  if (data.exists) {
                                    if (newCode === editingCenter.code || newCode === editingCenter.center_code) {
                                      setCenterCodeStatus("idle");
                                    } else {
                                      setCenterCodeStatus("taken");
                                    }
                                  } else {
                                    setCenterCodeStatus("available");
                                  }
                                } else {
                                  setCenterCodeStatus("idle");
                                }
                              } catch {
                                setCenterCodeStatus("idle");
                              }
                            }}
                            placeholder="Enter custom center code, leave blank for auto-generated"
                          />
                          {centerCodeStatus === "checking" && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />}
                          {centerCodeStatus === "available" && <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />}
                          {centerCodeStatus === "taken" && <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />}
                        </div>
                        {centerCodeStatus === "available" && <p className="text-xs text-green-600 font-medium ml-1">Center code available!</p>}
                        {centerCodeStatus === "taken" && <p className="text-xs text-red-600 font-medium ml-1">Center code already taken!</p>}
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-primary">Set New Password (Leave blank to keep current)</label>
                        <input
                          type="password"
                          autoComplete="new-password"
                          placeholder="Enter new password if you want to change it"
                          className="w-full px-4 py-2.5 rounded-none border border-primary/50 bg-background text-sm focus:border-primary focus:outline-none transition-all"
                          value={editingCenter.password || ""}
                          onChange={(e) => setExpandedCenter({ ...editingCenter, password: e.target.value })}
                        />
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">About Center</label>
                        <textarea
                          rows={4}
                          spellCheck={true}
                          lang="en"
                          className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all resize-none"
                          value={editingCenter.about_center || ""}
                          onChange={(e) => setExpandedCenter({ ...editingCenter, about_center: e.target.value })}
                          placeholder="Write a short overview about this center..."
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Location Details */}
                  <Card className="lg:col-span-2 rounded-none border-border shadow-md overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b border-border py-4">
                      <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                        <Globe className="w-4 h-4 text-primary" />
                        Location Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">Country</label>
                        <select
                          className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                          value={editSelectedCountry || ""}
                          onChange={(e) => {
                            setEditSelectedCountry(e.target.value || null);
                            setEditCustomCountry("");
                            if (editingCenter) {
                              if (e.target.value !== "other") {
                                const country = countries.find(c => c.id === e.target.value);
                                setExpandedCenter({
                                  ...editingCenter,
                                  location: { ...(editingCenter.location || {}), country: country?.name || "" },
                                });
                              }
                            }
                          }}
                        >
                          <option value="">-- Select Country --</option>
                          <option value="other">-- Other (Enter manually) --</option>
                          {countries.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        {editSelectedCountry === "other" && (
                          <input
                            placeholder="Enter Country Name"
                            className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all mt-2"
                            value={editCustomCountry}
                            onChange={(e) => {
                              setEditCustomCountry(e.target.value);
                              if (editingCenter) {
                                setExpandedCenter({
                                  ...editingCenter,
                                  location: { ...(editingCenter.location || {}), country: e.target.value }
                                });
                              }
                            }}
                          />
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">State</label>
                        <select
                          className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                          value={editSelectedState || ""}
                          onChange={(e) => {
                            setEditSelectedState(e.target.value || null);
                            setEditCustomState("");
                            if (editingCenter) {
                              if (e.target.value !== "other") {
                                const state = states.find(s => s.id === e.target.value);
                                setExpandedCenter({
                                  ...editingCenter,
                                  state: state?.name || "",
                                  location: { ...(editingCenter.location || {}), state: state?.name || "" },
                                });
                              }
                            }
                          }}
                        >
                          <option value="">-- Select State --</option>
                          <option value="other">-- Other (Enter manually) --</option>
                          {states.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        {editSelectedState === "other" && (
                          <input
                            placeholder="Enter State Name"
                            className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all mt-2"
                            value={editCustomState}
                            onChange={(e) => {
                              setEditCustomState(e.target.value);
                              if (editingCenter) {
                                setExpandedCenter({
                                  ...editingCenter,
                                  state: e.target.value,
                                  location: { ...(editingCenter.location || {}), state: e.target.value },
                                });
                              }
                            }}
                          />
                        )}
                        {editSelectedCountry === "other" && (
                          <input
                            name="state"
                            spellCheck={true}
                            lang="en"
                            className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                            value={editingCenter.state || ""}
                            onChange={(e) =>
                              setExpandedCenter({
                                ...editingCenter,
                                state: e.target.value,
                              })
                            }
                            placeholder="State Name"
                          />
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">District</label>
                        <select
                          className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                          value={editSelectedDistrict || ""}
                          onChange={(e) => {
                            setEditSelectedDistrict(e.target.value || null);
                            setEditCustomDistrict("");
                            if (editingCenter) {
                              if (e.target.value !== "other") {
                                const district = districts.find(d => d.id === e.target.value);
                                setExpandedCenter({
                                  ...editingCenter,
                                  district: district?.name || "",
                                  location: { ...(editingCenter.location || {}), district: district?.name || "" },
                                });
                              }
                            }
                          }}
                        >
                          <option value="">-- Select District --</option>
                          <option value="other">-- Other (Enter manually) --</option>
                          {districts.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                        {editSelectedDistrict === "other" && (
                          <input
                            placeholder="Enter District Name"
                            className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all mt-2"
                            value={editCustomDistrict}
                            onChange={(e) => {
                              setEditCustomDistrict(e.target.value);
                              if (editingCenter) {
                                setExpandedCenter({
                                  ...editingCenter,
                                  district: e.target.value,
                                  location: { ...(editingCenter.location || {}), district: e.target.value },
                                });
                              }
                            }}
                          />
                        )}
                        {editSelectedState === "other" && (
                          <input
                            name="district"
                            spellCheck={true}
                            lang="en"
                            className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                            value={editingCenter.location?.district || ""}
                            onChange={(e) =>
                              setExpandedCenter({
                                ...editingCenter,
                                location: { ...(editingCenter.location || {}), district: e.target.value },
                              })
                            }
                            placeholder="District Name"
                          />
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">City</label>
                        <select
                          className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                          value={editSelectedCity || ""}
                          onChange={(e) => {
                            setEditSelectedCity(e.target.value || null);
                            setEditCustomCity("");
                            if (editingCenter) {
                              if (e.target.value !== "other") {
                                const city = cities.find(c => c.id === e.target.value);
                                setExpandedCenter({
                                  ...editingCenter,
                                  city: city?.name || "",
                                  location: { ...(editingCenter.location || {}), city: city?.name || "" },
                                });
                              }
                            }
                          }}
                        >
                          <option value="">-- Select City --</option>
                          <option value="other">-- Other (Enter manually) --</option>
                          {cities.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        {editSelectedCity === "other" && (
                          <input
                            placeholder="Enter City Name"
                            className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all mt-2"
                            value={editCustomCity}
                            onChange={(e) => {
                              setEditCustomCity(e.target.value);
                              if (editingCenter) {
                                setExpandedCenter({
                                  ...editingCenter,
                                  city: e.target.value,
                                  location: { ...(editingCenter.location || {}), city: e.target.value },
                                });
                              }
                            }}
                          />
                        )}
                        {editSelectedDistrict === "other" && (
                          <input
                            name="city"
                            spellCheck={true}
                            lang="en"
                            className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                            value={editingCenter.city || ""}
                            onChange={(e) =>
                              setExpandedCenter({
                                ...editingCenter,
                                city: e.target.value,
                              })
                            }
                            placeholder="City Name"
                          />
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">Postal Code / Pincode</label>
                        <select
                          className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                          value={editSelectedPincode || ""}
                          onChange={(e) => {
                            setEditSelectedPincode(e.target.value || null);
                            setEditCustomPincode("");
                            if (editingCenter) {
                              if (e.target.value !== "other") {
                                const pincode = pincodes.find(p => p.id === e.target.value);
                                setExpandedCenter({
                                  ...editingCenter,
                                  location: { ...(editingCenter.location || {}), pincode: pincode?.name || "" }
                                });
                              }
                            }
                          }}
                        >
                          <option value="">-- Select Pincode --</option>
                          <option value="other">-- Other (Enter manually) --</option>
                          {pincodes.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        {editSelectedPincode === "other" && (
                          <input
                            placeholder="Enter Pincode"
                            className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all mt-2"
                            value={editCustomPincode}
                            onChange={(e) => {
                              setEditCustomPincode(e.target.value);
                              if (editingCenter) {
                                setExpandedCenter({
                                  ...editingCenter,
                                  location: { ...(editingCenter.location || {}), pincode: e.target.value }
                                });
                              }
                            }}
                          />
                        )}
                        {editSelectedCity === "other" && (
                          <input
                            name="pincode"
                            placeholder="6-digit Pincode"
                            className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                            value={editingCenter.location?.pincode || ""}
                            onChange={(e) =>
                              setExpandedCenter({
                                ...editingCenter,
                                location: { ...(editingCenter.location || {}), pincode: e.target.value },
                              })
                            }
                          />
                        )}
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">Full Address</label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                          <textarea
                            name="address"
                            rows={3}
                            spellCheck={true}
                            lang="en"
                            placeholder="Building / House No, Street, Area, Landmark"
                            className="w-full pl-10 pr-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all resize-none"
                            value={editingCenter.address || ""}
                            onChange={(e) =>
                              setExpandedCenter({
                                ...editingCenter,
                                address: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">Google Maps Embed URL</label>
                        <input
                          name="maps_embed_url"
                          placeholder="Paste only the Google Maps embed URL (https://...)"
                          className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                          value={editingCenter.location?.maps_embed_url || ""}
                          onChange={(e) =>
                            setExpandedCenter({
                              ...editingCenter,
                              location: { ...(editingCenter.location || {}), maps_embed_url: normalizeMapUrl(e.target.value) },
                            })
                          }
                        />
                        {editingCenter.location?.maps_embed_url && !editingCenter.location.maps_embed_url.includes("/maps/embed") && (
                          <p className="text-[10px] text-amber-600 font-bold mt-1 flex items-center gap-1">
                            <EyeOff className="w-3 h-3" />
                            Warning: This doesn't look like an embed URL. Map preview may not work.
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Infrastructure & Facilities */}
                  <Card className="lg:col-span-2 rounded-none border-border shadow-md overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b border-border py-4">
                      <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                        <Laptop className="w-4 h-4 text-primary" />
                        Infrastructure & Facilities
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">No. of Computers</label>
                        <input
                          name="computers"
                          type="number"
                          min={0}
                          className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                          value={(editingCenter.infrastructure as any)?.computers === 0 ? "" : (editingCenter.infrastructure as any)?.computers}
                          onChange={(e) => {
                            const v = e.target.value;
                            setExpandedCenter({
                              ...editingCenter,
                              infrastructure: {
                                ...(editingCenter.infrastructure || {}),
                                computers: v === "" ? 0 : Number(v),
                              },
                            });
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">No. of Classrooms</label>
                        <input
                          name="classrooms"
                          type="number"
                          min={0}
                          className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                          value={(editingCenter.infrastructure as any)?.classrooms === 0 ? "" : (editingCenter.infrastructure as any)?.classrooms}
                          onChange={(e) => {
                            const v = e.target.value;
                            setExpandedCenter({
                              ...editingCenter,
                              infrastructure: {
                                ...(editingCenter.infrastructure || {}),
                                classrooms: v === "" ? 0 : Number(v),
                              },
                            });
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">No. of Staff</label>
                        <input
                          name="staff"
                          type="number"
                          min={0}
                          className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                          value={(editingCenter.infrastructure as any)?.staff === 0 ? "" : (editingCenter.infrastructure as any)?.staff}
                          onChange={(e) => {
                            const v = e.target.value;
                            setExpandedCenter({
                              ...editingCenter,
                              infrastructure: {
                                ...(editingCenter.infrastructure || {}),
                                staff: v === "" ? 0 : Number(v),
                              },
                            });
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">Lab Type</label>
                        <input
                          name="lab_type"
                          placeholder="e.g. Modern"
                          spellCheck={true}
                          lang="en"
                          className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                          value={editingCenter.infrastructure?.lab_type || ""}
                          onChange={(e) =>
                            setExpandedCenter({
                              ...editingCenter,
                              infrastructure: { ...(editingCenter.infrastructure || {}), lab_type: e.target.value },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">Internet Availability</label>
                        <select
                          className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                          value={editingCenter.infrastructure?.internet_available ? "Yes" : "No"}
                          onChange={(e) =>
                            setExpandedCenter({
                              ...editingCenter,
                              infrastructure: { ...(editingCenter.infrastructure || {}), internet_available: e.target.value === "Yes" },
                            })
                          }
                        >
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">Power Backup</label>
                        <select
                          className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                          value={editingCenter.infrastructure?.power_backup ? "Yes" : "No"}
                          onChange={(e) =>
                            setExpandedCenter({
                              ...editingCenter,
                              infrastructure: { ...(editingCenter.infrastructure || {}), power_backup: e.target.value === "Yes" },
                            })
                          }
                        >
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Course Allotment */}
                  <Card className="lg:col-span-2 rounded-none border-border shadow-md overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b border-border py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                        <School className="w-4 h-4 text-primary" />
                        Course Allotment
                      </CardTitle>
                      <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                        <div className="relative w-full md:w-48">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                          <input
                            type="text"
                            placeholder="SEARCH COURSE..."
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
                            Select Course Categories
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="text-[8px] font-black uppercase tracking-widest text-primary hover:underline"
                              onClick={() => setSelectedCategories(categories.map(c => toId(c.id || c._id)))}
                            >
                              Select All
                            </button>
                            <button
                              type="button"
                              className="text-[8px] font-black uppercase tracking-widest text-muted-foreground hover:underline"
                              onClick={() => setSelectedCategories([])}
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                        {categoriesLoading ? (
                          <div className="flex items-center justify-center py-2">
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto p-2 border border-border/50 bg-muted/10 custom-scrollbar">
                            {categories.map((cat) => {
                              const id = toId(cat.id || cat._id);
                              const isCatSelected = selectedCategories.includes(id);
                              return (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedCategories(prev =>
                                      isCatSelected ? prev.filter(i => i !== id) : [...prev, id]
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
                            Select Courses
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="text-[8px] font-black uppercase tracking-widest text-primary hover:underline"
                              onClick={() => {
                                const filtered = courses.filter(c =>
                                  (selectedCategories.length === 0 || selectedCategories.includes(toId(c.category_id))) &&
                                  (c.course_name.toLowerCase().includes(courseSearchQuery.toLowerCase()) ||
                                    c.course_code?.toLowerCase().includes(courseSearchQuery.toLowerCase()))
                                );
                                setExpandedCenter({
                                  ...editingCenter,
                                  course_allotment: [...new Set([...(editingCenter.course_allotment || []), ...filtered.map(c => c.course_name)])]
                                });
                              }}
                            >
                              Select All Shown
                            </button>
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
                                const courseId = toId(c.id || c._id);
                                const courseName = c.course_name;
                                const list = editingCenter.course_allotment || [];
                                const isChecked = list.includes(courseId) || list.includes(courseName);
                                return (
                                  <label key={courseId} className={cn(
                                    "flex items-center gap-3 border p-3 transition-all cursor-pointer hover:bg-muted/50",
                                    isChecked ? "border-primary bg-primary/5" : "border-border bg-background"
                                  )}>
                                    <input
                                      type="checkbox"
                                      className="w-4 h-4 accent-primary"
                                      checked={isChecked}
                                      onChange={() => {
                                        const next = isChecked
                                          ? list.filter((x) => x !== courseId && x !== courseName)
                                          : [...list.filter(x => x !== courseId), courseName];
                                        setExpandedCenter({ ...editingCenter, course_allotment: next });
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
                                No courses available. Please create courses in the Academics section first.
                              </div>
                            )}
                            {courses.length > 0 && courses.filter(c => {
                              const matchesSearch = c.course_name.toLowerCase().includes(courseSearchQuery.toLowerCase()) ||
                                c.course_code?.toLowerCase().includes(courseSearchQuery.toLowerCase());
                              const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(toId(c.category_id));
                              return matchesSearch && matchesCategory;
                            }).length === 0 && (
                                <div className="md:col-span-2 text-center py-4 text-xs text-muted-foreground italic font-black uppercase tracking-widest">
                                  No matching courses found for selected filters
                                </div>
                              )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Bank Details */}
                  <Card className="lg:col-span-2 rounded-none border-border shadow-md overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b border-border py-4">
                      <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                        <Landmark className="w-4 h-4 text-primary" />
                        Bank Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">Bank Name</label>
                        <input
                          name="bank_name"
                          spellCheck={true}
                          lang="en"
                          className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                          value={(editingCenter.bank_details as any)?.bank_name || ""}
                          onChange={(e) =>
                            setExpandedCenter({
                              ...editingCenter,
                              bank_details: { ...(editingCenter.bank_details || {}), bank_name: e.target.value },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">Account Number</label>
                        <input
                          name="account_number"
                          className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                          value={(editingCenter.bank_details as any)?.account_number || ""}
                          onChange={(e) =>
                            setExpandedCenter({
                              ...editingCenter,
                              bank_details: { ...(editingCenter.bank_details || {}), account_number: e.target.value },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">IFSC Code</label>
                        <input
                          name="ifsc_code"
                          className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                          value={(editingCenter.bank_details as any)?.ifsc_code || ""}
                          onChange={(e) =>
                            setExpandedCenter({
                              ...editingCenter,
                              bank_details: { ...(editingCenter.bank_details || {}), ifsc_code: e.target.value },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">Account Holder</label>
                        <input
                          name="account_holder"
                          spellCheck={true}
                          lang="en"
                          className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                          value={(editingCenter.bank_details as any)?.account_holder || ""}
                          onChange={(e) =>
                            setExpandedCenter({
                              ...editingCenter,
                              bank_details: { ...(editingCenter.bank_details || {}), account_holder: e.target.value },
                            })
                          }
                        />
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">Branch Address</label>
                        <input
                          name="branch_address"
                          spellCheck={true}
                          lang="en"
                          className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                          value={editingCenter.bank_details?.branch_address || ""}
                          onChange={(e) =>
                            setExpandedCenter({
                              ...editingCenter,
                              bank_details: { ...(editingCenter.bank_details || {}), branch_address: e.target.value },
                            })
                          }
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Config & Validity */}
                  <Card className="lg:col-span-2 rounded-none border-border shadow-md overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b border-border py-4">
                      <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                        <Percent className="w-4 h-4 text-primary" />
                        Config & Validity
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">Creation Date</label>
                        <input
                          name="creation_date"
                          type="date"
                          className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                          value={editingCenter.config_validity?.creation_date || ""}
                          onChange={(e) =>
                            setExpandedCenter({
                              ...editingCenter,
                              config_validity: { ...(editingCenter.config_validity || {}), creation_date: e.target.value },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">Validity Date</label>
                        <input
                          name="validity_date"
                          type="date"
                          className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                          value={editingCenter.config_validity?.validity_date || ""}
                          onChange={(e) =>
                            setExpandedCenter({
                              ...editingCenter,
                              config_validity: { ...(editingCenter.config_validity || {}), validity_date: e.target.value },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">Franchise Fee</label>
                        <input
                          name="franchise_fee"
                          type="number"
                          min={0}
                          step="0.01"
                          className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                          value={(editingCenter.config_validity?.franchise_fee ?? 0) === 0 ? "" : (editingCenter.config_validity?.franchise_fee ?? 0)}
                          onChange={(e) => {
                            const v = e.target.value;
                            setExpandedCenter({
                              ...editingCenter,
                              config_validity: { ...(editingCenter.config_validity || {}), franchise_fee: v === "" ? 0 : Number(v) },
                            });
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">Royalty (%)</label>
                        <input
                          name="royalty_percent"
                          type="number"
                          min={0}
                          step="0.01"
                          className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                          value={(editingCenter.config_validity?.royalty_percent ?? 0) === 0 ? "" : (editingCenter.config_validity?.royalty_percent ?? 0)}
                          onChange={(e) => {
                            const v = e.target.value;
                            setExpandedCenter({
                              ...editingCenter,
                              config_validity: { ...(editingCenter.config_validity || {}), royalty_percent: v === "" ? 0 : Number(v) },
                            });
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">Discount Coupon (Optional)</label>
                        <div className="flex gap-2">
                          <input
                            name="discount_coupon"
                            placeholder="Enter discount coupon"
                            className="flex-1 px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                            value={editingCenter.discount_coupon || ""}
                            onChange={(e) =>
                              setExpandedCenter({ ...editingCenter, discount_coupon: e.target.value })
                            }
                          />
                          <button
                            type="button"
                            onClick={applyDiscountCoupon}
                            disabled={!editingCenter?.discount_coupon}
                            className="px-4 py-2 border border-border bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest disabled:opacity-50 rounded-none"
                          >
                            {discountApplied ? "Applied" : "Apply"}
                          </button>
                        </div>
                        {discountApplied && <p className="text-xs text-green-600 font-medium ml-1">Discount coupon applied!</p>}
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">Referral Code (Optional)</label>
                        <div className="flex gap-2">
                          <input
                            name="referral_code"
                            placeholder="Enter referral code"
                            className="flex-1 px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                            value={editingCenter.referral_code || ""}
                            onChange={(e) =>
                              setExpandedCenter({ ...editingCenter, referral_code: e.target.value })
                            }
                          />
                          <button
                            type="button"
                            onClick={applyReferralCode}
                            disabled={!editingCenter?.referral_code}
                            className="px-4 py-2 border border-border bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest disabled:opacity-50 rounded-none"
                          >
                            {referralApplied ? "Applied" : "Apply"}
                          </button>
                        </div>
                        {referralApplied && <p className="text-xs text-green-600 font-medium ml-1">Referral code applied!</p>}
                      </div>
                      <div className="md:col-span-2 border-t border-border pt-6 mt-2">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                          <BookOpen className="w-3 h-3 text-primary" />
                          Mock Test Subscription
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest ml-1">Enable Mock Test</label>
                            <select
                              className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                              value={editingCenter.config_validity?.mock_test_enabled ? "Yes" : "No"}
                              onChange={(e) =>
                                setExpandedCenter({
                                  ...editingCenter,
                                  config_validity: { ...(editingCenter.config_validity || {}), mock_test_enabled: e.target.value === "Yes" },
                                })
                              }
                            >
                              <option value="Yes">Yes (Enabled)</option>
                              <option value="No">No (Disabled)</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest ml-1">Start Date</label>
                            <input
                              name="mock_test_start_date"
                              type="date"
                              className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                              value={editingCenter.config_validity?.mock_test_start_date || ""}
                              onChange={(e) =>
                                setExpandedCenter({
                                  ...editingCenter,
                                  config_validity: { ...(editingCenter.config_validity || {}), mock_test_start_date: e.target.value },
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest ml-1">End Date (Expiry)</label>
                            <input
                              name="mock_test_end_date"
                              type="date"
                              className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                              value={editingCenter.config_validity?.mock_test_end_date || ""}
                              onChange={(e) =>
                                setExpandedCenter({
                                  ...editingCenter,
                                  config_validity: { ...(editingCenter.config_validity || {}), mock_test_end_date: e.target.value },
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Working Hours */}
                  <Card className="lg:col-span-2 rounded-none border-border shadow-md overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b border-border py-4">
                      <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
                        Working Hours
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">Opening Time</label>
                        <input
                          name="opening_time"
                          type="time"
                          className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                          value={editingCenter.working_hours?.opening_time || ""}
                          onChange={(e) =>
                            setExpandedCenter({
                              ...editingCenter,
                              working_hours: { ...(editingCenter.working_hours || {}), opening_time: e.target.value, working_days: editingCenter.working_hours?.working_days || [] },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">Closing Time</label>
                        <input
                          name="closing_time"
                          type="time"
                          className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                          value={editingCenter.working_hours?.closing_time || ""}
                          onChange={(e) =>
                            setExpandedCenter({
                              ...editingCenter,
                              working_hours: { ...(editingCenter.working_hours || {}), closing_time: e.target.value, working_days: editingCenter.working_hours?.working_days || [] },
                            })
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-widest mb-2">Working Days</label>
                        <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
                          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => {
                            const days = editingCenter.working_hours?.working_days || [];
                            const checked = days.includes(d);
                            return (
                              <label key={d} className={cn(
                                "flex flex-col items-center justify-center p-2 border cursor-pointer transition-all",
                                checked ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"
                              )}>
                                <input
                                  type="checkbox"
                                  className="hidden"
                                  checked={checked}
                                  onChange={() => {
                                    const next = checked ? days.filter((x) => x !== d) : [...days, d];
                                    setExpandedCenter({
                                      ...editingCenter,
                                      working_hours: { ...(editingCenter.working_hours || {}), working_days: next },
                                    });
                                  }}
                                />
                                <span className="text-[9px] font-black uppercase">{d}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">Status</label>
                    <select
                      className="w-full px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all font-bold uppercase"
                      value={editingCenter.active ? "true" : "false"}
                      onChange={(e) => setExpandedCenter({ ...editingCenter, active: e.target.value === "true" })}
                    >
                      <option value="true">Active</option>
                      <option value="false">Suspended</option>
                    </select>
                  </div>
                  <div className="md:col-span-2 h-px bg-border my-2" />

                  {/* Center Documents */}
                  <Card className="lg:col-span-2 rounded-none border-border shadow-md overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b border-border py-4">
                      <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        Center Documents
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      {(editingCenter.documents || []).map((d, i) => (
                        <div key={`${d.name}-${i}`} className="grid grid-cols-1 md:grid-cols-12 gap-3 border border-border p-3 items-center">
                          <div className="md:col-span-4">
                            <input
                              placeholder="Document name"
                              className="w-full px-3 py-2 border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                              value={d.name}
                              onChange={(e) => {
                                const next = [...(editingCenter.documents || [])];
                                next[i] = { ...next[i], name: e.target.value };
                                setExpandedCenter({ ...editingCenter, documents: next });
                              }}
                            />
                          </div>
                          <div className="md:col-span-4">
                            <input
                              placeholder="Document Number (Optional)"
                              className="w-full px-3 py-2 border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                              value={d.number || ""}
                              onChange={(e) => {
                                const next = [...(editingCenter.documents || [])];
                                next[i] = { ...next[i], number: e.target.value };
                                setExpandedCenter({ ...editingCenter, documents: next });
                              }}
                            />
                          </div>
                          <div className="md:col-span-3 flex items-center justify-between gap-3">
                            <div className="text-xs text-muted-foreground truncate flex-1">
                              {d.url ? t("File uploaded") : t("No file chosen")}
                            </div>
                            <label className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1 cursor-pointer">
                              <span>{uploadingField === `doc_${i}` ? "Uploading..." : "Upload"}</span>
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  const url = await uploadRaw(file, `doc_${i}`);
                                  if (!url) return;
                                  const next = [...(editingCenter.documents || [])];
                                  next[i] = { ...next[i], url };
                                  setExpandedCenter({ ...editingCenter, documents: next });
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              className="text-xs font-bold underline"
                              onClick={() => {
                                const next = [...(editingCenter.documents || [])].filter((_, idx) => idx !== i);
                                setExpandedCenter({ ...editingCenter, documents: next });
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-3">
                        <button
                          type="button"
                          className="border border-border px-4 py-2 text-xs font-black uppercase tracking-widest"
                          onClick={() => setExpandedCenter({ ...editingCenter, documents: [...(editingCenter.documents || []), { name: "", number: "", url: "" }] })}
                        >
                          Add Row
                        </button>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t("Upload is optional here; key documents below include required Auth Letter.")}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Key Documents */}
                  <Card className="lg:col-span-2 rounded-none border-border shadow-md overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b border-border py-4">
                      <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        Key Documents
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                      {[
                        { key: "auth_letter_url", label: "Auth Letter (PDF)", accept: "application/pdf" },
                        { key: "owner_photo_url", label: "Owner Photo", accept: "image/*" },
                        { key: "owner_signature_url", label: "Owner Signature", accept: "image/*" },
                        { key: "center_stamp_url", label: "Center Stamp", accept: "image/*" },
                      ].map((it) => {
                        const url = (editingCenter.key_documents as any)?.[it.key];
                        return (
                          <div key={it.key} className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest ml-1 flex items-center gap-2">
                              <FileText className="w-3 h-3" />
                              {it.label}
                            </label>
                            <div className="relative">
                              <input
                                placeholder="Uploaded file URL"
                                className="w-full pr-24 px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                                value={url || ""}
                                onChange={(e) => {
                                  setExpandedCenter({
                                    ...editingCenter,
                                    key_documents: { ...(editingCenter.key_documents || {}), [it.key]: e.target.value },
                                  });
                                }}
                              />
                              <label className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 cursor-pointer">
                                <span>{uploadingField === `key_documents_${it.key}` ? "Uploading..." : "Upload"}</span>
                                <input
                                  type="file"
                                  accept={it.accept}
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const newUrl = await uploadRaw(file, `key_documents_${it.key}`);
                                    if (!newUrl) return;
                                    setExpandedCenter({
                                      ...editingCenter,
                                      key_documents: { ...(editingCenter.key_documents || {}), [it.key]: newUrl },
                                    });
                                  }}
                                />
                              </label>
                            </div>
                            {url && (
                              <div className="mt-2 p-2 border border-border bg-muted/20">
                                {url.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
                                  <img src={url} alt={it.label} className="h-20 object-contain mx-auto" />
                                ) : (
                                  <a className="inline-block text-[10px] font-black uppercase tracking-widest underline" href={url} target="_blank" rel="noreferrer">
                                    Open {it.label}
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>

                  {/* Branding & Media */}
                  <Card className="lg:col-span-2 rounded-none border-border shadow-md overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b border-border py-4">
                      <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-primary" />
                        Branding & Media
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                      {[
                        { key: "center_logo_url", label: "Center Logo", accept: "image/*" },
                        { key: "banner_image_url", label: "Banner Image", accept: "image/*" },
                        { key: "qr_code_1_url", label: "QR Code 1", accept: "image/*" },
                        { key: "qr_code_2_url", label: "QR Code 2", accept: "image/*" },
                      ].map((it) => {
                        const url = (editingCenter.branding_media as any)?.[it.key];
                        return (
                          <div key={it.key} className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest ml-1">{it.label}</label>
                            <div className="relative">
                              <input
                                placeholder="Uploaded file URL"
                                className="w-full pr-24 px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                                value={url || ""}
                                onChange={(e) => {
                                  setExpandedCenter({
                                    ...editingCenter,
                                    branding_media: { ...(editingCenter.branding_media || { gallery_urls: [] }), [it.key]: e.target.value, gallery_urls: editingCenter.branding_media?.gallery_urls || [] },
                                  });
                                }}
                              />
                              <label className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 cursor-pointer">
                                <span>{uploadingField === `branding_media_${it.key}` ? "Uploading..." : "Upload"}</span>
                                <input
                                  type="file"
                                  accept={it.accept}
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const newUrl = await uploadRaw(file, `branding_media_${it.key}`);
                                    if (!newUrl) return;
                                    setExpandedCenter({
                                      ...editingCenter,
                                      branding_media: { ...(editingCenter.branding_media || { gallery_urls: [] }), [it.key]: newUrl, gallery_urls: editingCenter.branding_media?.gallery_urls || [] },
                                    });
                                  }}
                                />
                              </label>
                            </div>
                            {url && (
                              <div className="mt-2 p-2 border border-border bg-muted/20">
                                {url.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
                                  <img src={url} alt={it.label} className="h-20 object-contain mx-auto" />
                                ) : (
                                  <a className="inline-block text-[10px] font-black uppercase tracking-widest underline" href={url} target="_blank" rel="noreferrer">
                                    Open {it.label}
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">Short Clips (Multiple)</label>
                        <div className="flex items-center justify-between gap-3 border border-border p-3">
                          <div className="text-xs text-muted-foreground truncate">
                            {(editingCenter.branding_media?.short_clip_urls || []).length ? t("{{count}} file(s) uploaded", { count: (editingCenter.branding_media?.short_clip_urls || []).length }) : t("No file chosen")}
                          </div>
                          <label className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1 cursor-pointer">
                            <span>{uploadingField === "edit_short_clip_urls" ? "Uploading..." : "Upload"}</span>
                            <input
                              type="file"
                              multiple
                              accept="video/*"
                              className="hidden"
                              onChange={async (e) => {
                                const files = Array.from(e.target.files || []);
                                for (const f of files) {
                                  const newUrl = await uploadRaw(f, "edit_short_clip_urls");
                                  if (newUrl) {
                                    setExpandedCenter(prev => ({
                                      ...prev!,
                                      branding_media: {
                                        ...(prev?.branding_media || {}),
                                        short_clip_urls: [...(prev?.branding_media?.short_clip_urls || []), newUrl],
                                      },
                                    }));
                                  }
                                }
                              }}
                            />
                          </label>
                          {(editingCenter.branding_media?.short_clip_urls || []).length > 0 && (
                            <button
                              type="button"
                              className="text-xs font-bold underline"
                              onClick={() => setExpandedCenter(prev => ({ ...prev!, branding_media: { ...(prev?.branding_media || {}), short_clip_urls: [] } }))}
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        {(editingCenter.branding_media?.short_clip_urls || []).length > 0 && (
                          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                            {(editingCenter.branding_media?.short_clip_urls || []).map((url, idx) => (
                              <div key={`edit-clip-${url}-${idx}`} className="aspect-video border border-border bg-muted/20 relative group overflow-hidden">
                                <video src={url} className="w-full h-full object-cover" controls playsInline />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExpandedCenter(prev => ({
                                      ...prev!,
                                      branding_media: {
                                        ...(prev?.branding_media || {}),
                                        short_clip_urls: prev?.branding_media?.short_clip_urls?.filter((_, i) => i !== idx) || [],
                                      },
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
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">Gallery (Multiple)</label>
                        <div className="flex items-center justify-between gap-3 border border-border p-3">
                          <div className="text-xs text-muted-foreground truncate">
                            {(editingCenter.branding_media?.gallery_urls || []).length ? t("{{count}} file(s) uploaded", { count: (editingCenter.branding_media?.gallery_urls || []).length }) : t("No file chosen")}
                          </div>
                          <label className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1 cursor-pointer">
                            <span>{uploadingField === "edit_gallery_urls" ? "Uploading..." : "Upload"}</span>
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const files = Array.from(e.target.files || []);
                                for (const f of files) {
                                  const newUrl = await uploadRaw(f, "edit_gallery_urls");
                                  if (newUrl) {
                                    setExpandedCenter(prev => ({
                                      ...prev!,
                                      branding_media: {
                                        ...(prev?.branding_media || {}),
                                        gallery_urls: [...(prev?.branding_media?.gallery_urls || []), newUrl],
                                      },
                                    }));
                                  }
                                }
                              }}
                            />
                          </label>
                          {(editingCenter.branding_media?.gallery_urls || []).length > 0 && (
                            <button
                              type="button"
                              className="text-xs font-bold underline"
                              onClick={() => setExpandedCenter(prev => ({ ...prev!, branding_media: { ...(prev?.branding_media || {}), gallery_urls: [] } }))}
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        {(editingCenter.branding_media?.gallery_urls || []).length > 0 && (
                          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                            {(editingCenter.branding_media?.gallery_urls || []).map((url, idx) => (
                              <div key={`edit-gallery-${url}-${idx}`} className="aspect-square border border-border bg-muted/20 relative group overflow-hidden">
                                <img src={url} className="w-full h-full object-cover" alt={t("Gallery {{count}}", { count: idx + 1 })} />
                                <button
                                  type="button"
                                  className="absolute inset-0 bg-red-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-[10px] font-black uppercase"
                                  onClick={() => setExpandedCenter(prev => ({
                                    ...prev!,
                                    branding_media: {
                                      ...(prev?.branding_media || {}),
                                      gallery_urls: prev?.branding_media?.gallery_urls?.filter((_, i) => i !== idx) || [],
                                    },
                                  }))}
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Certificate Branding Assets */}
                  <Card className="lg:col-span-2 rounded-none border-border shadow-md overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b border-border py-4">
                      <CardTitle className="text-xs font-black uppercase tracking-[0.2em]">Certificate Branding Assets</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">Signature URL</label>
                        <div className="relative">
                          <input
                            placeholder="https://..."
                            className="w-full pr-24 px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                            value={assetsForm.signature_url}
                            onChange={(e) => setAssetsForm({ ...assetsForm, signature_url: e.target.value })}
                          />
                          <label className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 cursor-pointer">
                            <span>{uploadingField === "signature_url" ? "Uploading..." : "Upload"}</span>
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) uploadFile("signature_url", file);
                              }}
                            />
                          </label>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-1">Stamp URL</label>
                        <div className="relative">
                          <input
                            placeholder="https://..."
                            className="w-full pr-24 px-4 py-2.5 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                            value={assetsForm.stamp_url}
                            onChange={(e) => setAssetsForm({ ...assetsForm, stamp_url: e.target.value })}
                          />
                          <label className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 cursor-pointer">
                            <span>{uploadingField === "stamp_url" ? "Uploading..." : "Upload"}</span>
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) uploadFile("stamp_url", file);
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </CardContent>
                    <div className="px-6 pb-6 flex justify-end">
                      <button
                        type="button"
                        disabled={assetsSaving}
                        onClick={async () => {
                          setAssetsSaving(true);
                          try {
                            const res = await apiFetch("/api/center/assets", {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                center_id: toId(editingCenter?._id) || "",
                                signature_url: assetsForm.signature_url || undefined,
                                stamp_url: assetsForm.stamp_url || undefined,
                              }),
                            });
                            if (!res.ok) {
                              const msg = await res.text().catch(() => "");
                              toast.error(msg || "Failed to update assets");
                              return;
                            }
                            const data = await res.json().catch(() => null);
                            toast.success(data?.message || "Assets updated");
                          } finally {
                            setAssetsSaving(false);
                          }
                        }}
                        className="px-6 py-3 border border-border text-[10px] font-black uppercase tracking-widest hover:bg-muted transition-all"
                      >
                        {assetsSaving ? "Saving..." : "Save Branding"}
                      </button>
                    </div>
                  </Card>
                </CardContent>
                <div className="p-6 bg-muted/30 border-t border-border flex justify-end gap-4">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-6 py-3 border border-border text-[10px] font-black uppercase tracking-widest hover:bg-muted transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-primary text-primary-foreground px-8 py-3 rounded-none font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:opacity-90 transition-all flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save Changes
                  </button>
                </div>
              </form>
            </Card>
          </div>
        )}

        <Dialog open={!!previewHtml} onOpenChange={(open) => !open && setPreviewHtml("")}>
          <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 rounded-none border-primary z-[20000]">
            <DialogHeader className="p-6 border-b">
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Center Profile Preview</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto bg-white p-4">
              <style dangerouslySetInnerHTML={{
                __html: `
                .preview-container {
                  background: white;
                  color: #333;
                  padding: 20px;
                  max-width: 800px;
                  margin: 0 auto;
                  box-shadow: 0 0 20px rgba(0,0,0,0.05);
                }
                .preview-container .header { margin-top: 0 !important; }
              `}} />
              <div
                className="preview-container"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
            <DialogFooter className="p-4 border-t bg-muted/30">
              <Button
                variant="outline"
                onClick={() => setPreviewHtml("")}
                className="rounded-none font-black uppercase tracking-widest text-[10px]"
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  if (previewId) {
                    handlePrint(previewId);
                    setPreviewHtml("");
                  }
                }}
                className="rounded-none font-black uppercase tracking-widest text-[10px]"
              >
                <FileText className="w-3 h-3 mr-2" />
                Download PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default CenterListPage;
