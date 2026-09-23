import { useEffect, useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2, MapPin, Laptop, Clock, School, ShieldCheck,
  Send, Loader2, FileText, Image as ImageIcon, Phone, Mail,
  User, Globe, History, CheckCircle2, XCircle, Landmark, BookOpen, Upload, EyeOff, Search, Plus
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type Center = {
  _id: string;
  name: string;
  code: string;
  owner_name: string;
  about_center?: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  active: boolean;
  location?: {
    country?: string;
    state?: string;
    city?: string;
    address?: string;
    pincode?: string;
    maps_embed_url?: string
  };
  infrastructure?: { computers?: number; classrooms?: number; staff?: number; lab_type?: string; internet_available?: boolean; power_backup?: boolean };
  course_allotment?: string[];
  branding_media?: { center_logo_url?: string; banner_image_url?: string; gallery_urls?: string[]; qr_code_1_url?: string; qr_code_2_url?: string; short_clip_url?: string; short_clip_urls?: string[] };
  working_hours?: { opening_time?: string; closing_time?: string; working_days?: string[] };
  config_validity?: {
    creation_date?: string;
    validity_date?: string;
    franchise_fee?: number;
    royalty_percent?: number;
    mock_test_enabled?: boolean;
    mock_test_start_date?: string;
    mock_test_end_date?: string;
  };
  bank_details?: {
    bank_name?: string;
    account_number?: string;
    ifsc_code?: string;
    account_holder?: string;
    branch_address?: string;
  };
  key_documents?: {
    auth_letter_url?: string;
    owner_photo_url?: string;
    owner_signature_url?: string;
    center_stamp_url?: string;
  };
};

type UpdateRequest = {
  _id: string;
  status: string;
  requested_at: string;
  processed_at?: string;
  admin_notes?: string;
};

const CenterProfileUpdatePage = () => {
  const [center, setCenter] = useState<Center | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<UpdateRequest[]>([]);
  const [editData, setEditData] = useState<Partial<Center>>({});
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [courseSearchQuery, setCourseSearchQuery] = useState("");

  useEffect(() => {
    fetchData();
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const res = await apiFetch("/api/courses");
      if (res.ok) setCourses(await res.json());
    } catch { }
  };

  const filteredCourses = useMemo(() => {
    const q = courseSearchQuery.toLowerCase().trim();
    if (!q) return courses;
    return courses.filter(c =>
      c.course_name.toLowerCase().includes(q) ||
      c.course_code?.toLowerCase().includes(q)
    );
  }, [courses, courseSearchQuery]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cRes, rRes] = await Promise.all([
        apiFetch("/api/centers"),
        apiFetch("/api/center-updates")
      ]);

      if (cRes.ok) {
        const centers = await cRes.json();
        const current = centers[0] || null;
        setCenter(current);
        if (current) {
          // Initialize edit data with current values, ensure arrays/objects exist
          setEditData({
            ...current,
            branding_media: { gallery_urls: [], ...current.branding_media },
            working_hours: { working_days: [], ...current.working_hours },
            course_allotment: current.course_allotment || []
          });
        }
      }
      if (rRes.ok) setRequests(await rRes.json());
    } catch (error) {
      toast.error("Failed to load profile data");
    } finally {
      setLoading(false);
    }
  };

  const normalizeMapUrl = (value: string) => {
    const v = (value || "").trim();
    if (!v) return "";
    if (v.includes("<iframe") || v.includes("</iframe>")) {
      const match = v.match(/src\s*=\s*["']([^"']+)["']/i);
      const url = match?.[1]?.trim() || "";
      if (url.includes("google.com/maps/embed") || url.includes("google.co.in/maps/embed")) {
        return url;
      }
      return "";
    }
    return v;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const val = type === "number" ? (value === "" ? 0 : Number(value)) : value;

    // Handle nested objects
    if (name.includes(".")) {
      const [parent, child] = name.split(".");
      setEditData(prev => ({
        ...prev,
        [parent]: {
          ...(prev as any)[parent],
          [child]: val
        }
      }));
    } else {
      setEditData(prev => ({ ...prev, [name]: val }));
    }
  };

  const uploadFile = async (field: string, file: File) => {
    setUploadingField(field);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await apiFetch("/api/uploads", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.url) {
        if (field.includes(".")) {
          const [parent, child] = field.split(".");
          setEditData(prev => ({
            ...prev,
            [parent]: {
              ...(prev as any)[parent],
              [child]: data.url
            }
          }));
        } else {
          setEditData(prev => ({ ...prev, [field]: data.url }));
        }
        toast.success("File uploaded");
      }
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploadingField(null);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/center-updates", {
        method: "POST",
        body: JSON.stringify({ new_data: editData })
      });
      if (res.ok) {
        toast.success("Update request sent to Admin");
        fetchData();
      } else {
        const d = await res.json();
        toast.error(d.message || "Failed to send request");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <DashboardLayout role="Center"><div className="p-8">Loading profile...</div></DashboardLayout>;
  if (!center) return <DashboardLayout role="Center"><div className="p-8">No center found.</div></DashboardLayout>;

  const hasPendingRequest = requests.some(r => r.status === "pending");

  return (
    <DashboardLayout role="Center">
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Update Center Profile</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">Request changes to your center information. All changes require Admin approval.</p>
          </div>
          {hasPendingRequest && (
            <div className="bg-amber-500/10 border border-amber-500/20 px-4 py-2 flex items-center gap-2 text-amber-600 text-xs font-black uppercase tracking-widest">
              <Clock className="w-4 h-4" />
              Request Pending Approval
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSubmitRequest} className="space-y-6">
              {/* Basic Info */}
              <Card className="rounded-none border-border shadow-md overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border py-4">
                  <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" />
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">Center Name</label>
                    <input name="name" value={editData.name || ""} onChange={handleChange} className="w-full px-4 py-2.5 border border-border bg-background text-sm font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">Owner Name</label>
                    <input name="owner_name" value={editData.owner_name || ""} onChange={handleChange} className="w-full px-4 py-2.5 border border-border bg-background text-sm font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">Phone</label>
                    <input name="phone" value={editData.phone || ""} onChange={handleChange} className="w-full px-4 py-2.5 border border-border bg-background text-sm font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">Email</label>
                    <input name="email" value={editData.email || ""} onChange={handleChange} className="w-full px-4 py-2.5 border border-border bg-muted text-sm font-bold" disabled />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">About Center</label>
                    <textarea name="about_center" value={editData.about_center || ""} onChange={handleChange} rows={3} className="w-full px-4 py-2.5 border border-border bg-background text-sm font-bold resize-none" placeholder="Brief description of your center..." />
                  </div>
                </CardContent>
              </Card>

              {/* Location */}
              <Card className="rounded-none border-border shadow-md overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border py-4">
                  <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    Location & Address
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">Country</label>
                    <input name="location.country" value={editData.location?.country || ""} onChange={handleChange} className="w-full px-4 py-2.5 border border-border bg-background text-sm font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">State</label>
                    <input name="state" value={editData.state || ""} onChange={handleChange} className="w-full px-4 py-2.5 border border-border bg-background text-sm font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">District</label>
                    <input name="location.district" value={editData.location?.district || ""} onChange={(e) => {
                        setEditData(prev => ({
                          ...prev,
                          location: { ...(prev.location || {}), district: e.target.value },
                          district: e.target.value // Keep top-level field in sync
                        }));
                      }} className="w-full px-4 py-2.5 border border-border bg-background text-sm font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">City</label>
                    <input name="city" value={editData.city || ""} onChange={handleChange} className="w-full px-4 py-2.5 border border-border bg-background text-sm font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">Postal Code / Pincode</label>
                    <input name="location.pincode" value={editData.location?.pincode || ""} onChange={handleChange} placeholder="Postal / ZIP code" className="w-full px-4 py-2.5 border border-border bg-background text-sm font-bold" />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">Full Address</label>
                    <textarea name="address" value={editData.address || ""} onChange={handleChange} rows={2} className="w-full px-4 py-2.5 border border-border bg-background text-sm font-bold resize-none" />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">Google Maps Embed URL</label>
                    <input
                      name="location.maps_embed_url"
                      value={editData.location?.maps_embed_url || ""}
                      onChange={(e) => {
                        const val = normalizeMapUrl(e.target.value);
                        setEditData(prev => ({
                          ...prev,
                          location: { ...(prev.location || {}), maps_embed_url: val }
                        }));
                      }}
                      className="w-full px-4 py-2.5 border border-border bg-background text-sm font-bold"
                      placeholder="Paste <iframe> src or map URL"
                    />
                    {editData.location?.maps_embed_url && (
                      <div className="mt-2 aspect-video w-full border border-border overflow-hidden">
                        <iframe
                          src={editData.location.maps_embed_url}
                          className="w-full h-full"
                          loading="lazy"
                          title="Center Location Map"
                        ></iframe>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Infrastructure */}
              <Card className="rounded-none border-border shadow-md overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border py-4">
                  <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-primary" />
                    Infrastructure
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">Computers</label>
                    <input type="number" name="infrastructure.computers" value={editData.infrastructure?.computers || 0} onChange={handleChange} className="w-full px-4 py-2.5 border border-border bg-background text-sm font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">Classrooms</label>
                    <input type="number" name="infrastructure.classrooms" value={editData.infrastructure?.classrooms || 0} onChange={handleChange} className="w-full px-4 py-2.5 border border-border bg-background text-sm font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">Staff</label>
                    <input type="number" name="infrastructure.staff" value={editData.infrastructure?.staff || 0} onChange={handleChange} className="w-full px-4 py-2.5 border border-border bg-background text-sm font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">Lab Type</label>
                    <input name="infrastructure.lab_type" value={editData.infrastructure?.lab_type || ""} onChange={handleChange} className="w-full px-4 py-2.5 border border-border bg-background text-sm font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">Internet Available</label>
                    <select name="infrastructure.internet_available" value={String(!!editData.infrastructure?.internet_available)} onChange={handleChange} className="w-full px-4 py-2.5 border border-border bg-background text-sm font-bold">
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">Power Backup</label>
                    <select name="infrastructure.power_backup" value={String(!!editData.infrastructure?.power_backup)} onChange={handleChange} className="w-full px-4 py-2.5 border border-border bg-background text-sm font-bold">
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                </CardContent>
              </Card>

              {/* Course Allotment */}
              <Card className="rounded-none border-border shadow-md overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border py-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                      <School className="w-4 h-4 text-primary" />
                      Course Allotment
                    </CardTitle>
                    <div className="relative w-48">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search courses..."
                        className="w-full pl-7 pr-3 py-1 bg-background border border-border text-[9px] font-bold uppercase tracking-widest focus:outline-none"
                        value={courseSearchQuery}
                        onChange={(e) => setCourseSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto custom-scrollbar">
                  {filteredCourses.map((course) => {
                    const cName = course.course_name;
                    const isSelected = (editData.course_allotment || []).includes(cName);
                    return (
                      <label key={course._id} className={cn(
                        "flex items-center gap-3 p-3 border transition-all cursor-pointer",
                        isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"
                      )}>
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-primary"
                          checked={isSelected}
                          onChange={() => {
                            const current = editData.course_allotment || [];
                            const next = isSelected ? current.filter(c => c !== cName) : [...current, cName];
                            setEditData(prev => ({ ...prev, course_allotment: next }));
                          }}
                        />
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase tracking-tight">{cName}</span>
                          <span className="text-[8px] font-bold text-muted-foreground uppercase">{course.course_code}</span>
                        </div>
                      </label>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Bank Details */}
              <Card className="rounded-none border-border shadow-md overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border py-4">
                  <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-primary" />
                    Bank Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">Bank Name</label>
                    <input name="bank_details.bank_name" value={editData.bank_details?.bank_name || ""} onChange={handleChange} className="w-full px-4 py-2.5 border border-border bg-background text-sm font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">Account Number</label>
                    <input name="bank_details.account_number" value={editData.bank_details?.account_number || ""} onChange={handleChange} className="w-full px-4 py-2.5 border border-border bg-background text-sm font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">IFSC Code</label>
                    <input name="bank_details.ifsc_code" value={editData.bank_details?.ifsc_code || ""} onChange={handleChange} className="w-full px-4 py-2.5 border border-border bg-background text-sm font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">Account Holder Name</label>
                    <input name="bank_details.account_holder" value={editData.bank_details?.account_holder || ""} onChange={handleChange} className="w-full px-4 py-2.5 border border-border bg-background text-sm font-bold" />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">Branch Address</label>
                    <input name="bank_details.branch_address" value={editData.bank_details?.branch_address || ""} onChange={handleChange} className="w-full px-4 py-2.5 border border-border bg-background text-sm font-bold" />
                  </div>
                </CardContent>
              </Card>

              {/* Working Hours */}
              <Card className="rounded-none border-border shadow-md overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border py-4">
                  <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    Working Hours & Days
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">Opening Time</label>
                    <input type="time" name="working_hours.opening_time" value={editData.working_hours?.opening_time || ""} onChange={handleChange} className="w-full px-4 py-2.5 border border-border bg-background text-sm font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">Closing Time</label>
                    <input type="time" name="working_hours.closing_time" value={editData.working_hours?.closing_time || ""} onChange={handleChange} className="w-full px-4 py-2.5 border border-border bg-background text-sm font-bold" />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">Working Days</label>
                    <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => {
                        const days = editData.working_hours?.working_days || [];
                        const isChecked = days.includes(day);
                        return (
                          <label key={day} className={cn(
                            "flex flex-col items-center justify-center p-2 border cursor-pointer transition-all",
                            isChecked ? "bg-primary text-white border-primary" : "bg-background border-border"
                          )}>
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={isChecked}
                              onChange={() => {
                                const next = isChecked ? days.filter(d => d !== day) : [...days, day];
                                setEditData(prev => ({
                                  ...prev,
                                  working_hours: { ...(prev.working_hours || {}), working_days: next }
                                }));
                              }}
                            />
                            <span className="text-[9px] font-black uppercase">{day}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Config & Validity (View Only for Center) */}
              <Card className="rounded-none border-border shadow-md overflow-hidden bg-muted/5">
                <CardHeader className="bg-muted/30 border-b border-border py-4">
                  <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    Center Configuration (Read Only)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 opacity-80">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Creation Date</p>
                    <p className="text-xs font-bold">{editData.config_validity?.creation_date || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Validity Date</p>
                    <p className="text-xs font-bold">{editData.config_validity?.validity_date || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Franchise Fee</p>
                    <p className="text-xs font-bold">₹{editData.config_validity?.franchise_fee || 0}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Royalty (%)</p>
                    <p className="text-xs font-bold">{editData.config_validity?.royalty_percent || 0}%</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Mock Test</p>
                    <p className="text-xs font-bold">{editData.config_validity?.mock_test_enabled ? "Enabled" : "Disabled"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Mock Test Validity</p>
                    <p className="text-xs font-bold">{editData.config_validity?.mock_test_start_date} to {editData.config_validity?.mock_test_end_date}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Identity & Branding */}
              <Card className="rounded-none border-border shadow-md overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border py-4">
                  <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    Sign & Stamp (Identity)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Auth Letter */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest">Authorization Letter</label>
                    <div className="border-2 border-dashed border-border p-4 flex flex-col items-center gap-4 bg-muted/5 relative group">
                      {editData.key_documents?.auth_letter_url ? (
                        <div className="h-32 flex flex-col items-center justify-center">
                          <FileText className="w-10 h-10 mb-2 text-primary" />
                          <p className="text-[10px] font-bold uppercase">Letter Uploaded</p>
                          <a href={editData.key_documents.auth_letter_url} target="_blank" rel="noreferrer" className="text-[8px] underline mt-1">View File</a>
                        </div>
                      ) : (
                        <div className="h-32 flex flex-col items-center justify-center opacity-40">
                          <FileText className="w-10 h-10 mb-2" />
                          <p className="text-[10px] font-bold">NO LETTER</p>
                        </div>
                      )}
                      <label className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-black uppercase cursor-pointer hover:opacity-90">
                        {uploadingField === "key_documents.auth_letter_url" ? "Uploading..." : "Upload Letter"}
                        <input type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => e.target.files?.[0] && uploadFile("key_documents.auth_letter_url", e.target.files[0])} />
                      </label>
                    </div>
                  </div>

                  {/* Owner Photo */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest">Owner Photo</label>
                    <div className="border-2 border-dashed border-border p-4 flex flex-col items-center gap-4 bg-muted/5 relative group">
                      {editData.key_documents?.owner_photo_url ? (
                        <img src={editData.key_documents.owner_photo_url} className="h-32 w-32 object-cover border border-border" alt="Owner" />
                      ) : (
                        <div className="h-32 flex flex-col items-center justify-center opacity-40">
                          <User className="w-10 h-10 mb-2" />
                          <p className="text-[10px] font-bold">NO PHOTO</p>
                        </div>
                      )}
                      <label className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-black uppercase cursor-pointer hover:opacity-90">
                        {uploadingField === "key_documents.owner_photo_url" ? "Uploading..." : "Change Photo"}
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadFile("key_documents.owner_photo_url", e.target.files[0])} />
                      </label>
                    </div>
                  </div>

                  {/* Owner Signature */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest">Owner Signature</label>
                    <div className="border-2 border-dashed border-border p-4 flex flex-col items-center gap-4 bg-muted/5 relative group">
                      {editData.key_documents?.owner_signature_url ? (
                        <img src={editData.key_documents.owner_signature_url} className="h-32 object-contain" alt="Signature" />
                      ) : (
                        <div className="h-32 flex flex-col items-center justify-center opacity-40">
                          <FileText className="w-10 h-10 mb-2" />
                          <p className="text-[10px] font-bold">NO SIGNATURE</p>
                        </div>
                      )}
                      <label className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-black uppercase cursor-pointer hover:opacity-90">
                        {uploadingField === "key_documents.owner_signature_url" ? "Uploading..." : "Change Signature"}
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadFile("key_documents.owner_signature_url", e.target.files[0])} />
                      </label>
                    </div>
                  </div>

                  {/* Center Stamp */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest">Center Stamp</label>
                    <div className="border-2 border-dashed border-border p-4 flex flex-col items-center gap-4 bg-muted/5 relative group">
                      {editData.key_documents?.center_stamp_url ? (
                        <img src={editData.key_documents.center_stamp_url} className="h-32 object-contain" alt="Stamp" />
                      ) : (
                        <div className="h-32 flex flex-col items-center justify-center opacity-40">
                          <ImageIcon className="w-10 h-10 mb-2" />
                          <p className="text-[10px] font-bold">NO STAMP</p>
                        </div>
                      )}
                      <label className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-black uppercase cursor-pointer hover:opacity-90">
                        {uploadingField === "key_documents.center_stamp_url" ? "Uploading..." : "Change Stamp"}
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadFile("key_documents.center_stamp_url", e.target.files[0])} />
                      </label>
                    </div>
                  </div>

                  {/* Center Logo */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest">Center Logo</label>
                    <div className="border-2 border-dashed border-border p-4 flex flex-col items-center gap-4 bg-muted/5 relative group">
                      {editData.branding_media?.center_logo_url ? (
                        <img src={editData.branding_media.center_logo_url} className="h-32 w-32 object-contain" alt="Logo" />
                      ) : (
                        <div className="h-32 flex flex-col items-center justify-center opacity-40">
                          <ImageIcon className="w-10 h-10 mb-2" />
                          <p className="text-[10px] font-bold">NO LOGO</p>
                        </div>
                      )}
                      <label className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-black uppercase cursor-pointer hover:opacity-90">
                        {uploadingField === "branding_media.center_logo_url" ? "Uploading..." : "Change Logo"}
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadFile("branding_media.center_logo_url", e.target.files[0])} />
                      </label>
                    </div>
                  </div>

                  {/* QR Codes */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest">Payment QR Code 1</label>
                    <div className="border-2 border-dashed border-border p-4 flex flex-col items-center gap-4 bg-muted/5 relative group">
                      {editData.branding_media?.qr_code_1_url ? (
                        <img src={editData.branding_media.qr_code_1_url} className="h-32 w-32 object-contain" alt="QR 1" />
                      ) : (
                        <div className="h-32 flex flex-col items-center justify-center opacity-40">
                          <ImageIcon className="w-10 h-10 mb-2" />
                          <p className="text-[10px] font-bold">NO QR CODE</p>
                        </div>
                      )}
                      <label className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-black uppercase cursor-pointer hover:opacity-90">
                        {uploadingField === "branding_media.qr_code_1_url" ? "Uploading..." : "Change QR"}
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadFile("branding_media.qr_code_1_url", e.target.files[0])} />
                      </label>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest">Payment QR Code 2</label>
                    <div className="border-2 border-dashed border-border p-4 flex flex-col items-center gap-4 bg-muted/5 relative group">
                      {editData.branding_media?.qr_code_2_url ? (
                        <img src={editData.branding_media.qr_code_2_url} className="h-32 w-32 object-contain" alt="QR 2" />
                      ) : (
                        <div className="h-32 flex flex-col items-center justify-center opacity-40">
                          <ImageIcon className="w-10 h-10 mb-2" />
                          <p className="text-[10px] font-bold">NO QR CODE</p>
                        </div>
                      )}
                      <label className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-black uppercase cursor-pointer hover:opacity-90">
                        {uploadingField === "branding_media.qr_code_2_url" ? "Uploading..." : "Change QR"}
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadFile("branding_media.qr_code_2_url", e.target.files[0])} />
                      </label>
                    </div>
                  </div>

                  {/* Short Clips (Multiple) */}
                  <div className="md:col-span-2 space-y-4 pt-4 border-t border-border">
                    <label className="text-[10px] font-black uppercase tracking-widest">Short Clips (Multiple)</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {(editData.branding_media?.short_clip_urls || []).map((url, idx) => (
                        <div key={idx} className="relative group aspect-video border border-border bg-muted/10 overflow-hidden">
                          {url ? (
                            <video src={url} className="w-full h-full object-cover" controls playsInline />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center opacity-40">
                              <ImageIcon className="w-6 h-6" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                            <label className="bg-white text-black px-2 py-1 text-[8px] font-black uppercase cursor-pointer">
                              {uploadingField === `shortclip_${idx}` ? "..." : "Change"}
                              <input type="file" className="hidden" accept="video/*" onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setUploadingField(`shortclip_${idx}`);
                                try {
                                  const fd = new FormData();
                                  fd.append("file", file);
                                  const res = await apiFetch("/api/uploads", { method: "POST", body: fd });
                                  const data = await res.json();
                                  if (res.ok && data.url) {
                                    const next = [...(editData.branding_media?.short_clip_urls || [])];
                                    next[idx] = data.url;
                                    setEditData(prev => ({
                                      ...prev,
                                      branding_media: { ...(prev.branding_media || { short_clip_urls: [] }), short_clip_urls: next }
                                    }));
                                  }
                                } finally {
                                  setUploadingField(null);
                                }
                              }} />
                            </label>
                            <button
                              type="button"
                              className="bg-red-500 text-white px-2 py-1 text-[8px] font-black uppercase"
                              onClick={() => {
                                const next = (editData.branding_media?.short_clip_urls || []).filter((_, i) => i !== idx);
                                setEditData(prev => ({
                                  ...prev,
                                  branding_media: { ...(prev.branding_media || { short_clip_urls: [] }), short_clip_urls: next }
                                }));
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="aspect-video border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 hover:bg-muted/30 transition-all group"
                        onClick={() => {
                          const current = editData.branding_media?.short_clip_urls || [];
                          setEditData(prev => ({
                            ...prev,
                            branding_media: { ...(prev.branding_media || { short_clip_urls: [] }), short_clip_urls: [...current, ""] }
                          }));
                        }}
                      >
                        <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-primary">Add Clip</span>
                      </button>
                    </div>
                  </div>

                  {/* Gallery */}
                  <div className="md:col-span-2 space-y-4 pt-4 border-t border-border">
                    <label className="text-[10px] font-black uppercase tracking-widest">Gallery Images</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {(editData.branding_media?.gallery_urls || []).map((url, idx) => (
                        <div key={idx} className="relative group aspect-square border border-border bg-muted/10 overflow-hidden">
                          {url ? (
                            <img src={url} className="w-full h-full object-cover" alt={`Gallery ${idx + 1}`} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center opacity-40">
                              <ImageIcon className="w-6 h-6" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                            <label className="bg-white text-black px-2 py-1 text-[8px] font-black uppercase cursor-pointer">
                              {uploadingField === `gallery_${idx}` ? "..." : "Change"}
                              <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setUploadingField(`gallery_${idx}`);
                                try {
                                  const fd = new FormData();
                                  fd.append("file", file);
                                  const res = await apiFetch("/api/uploads", { method: "POST", body: fd });
                                  const data = await res.json();
                                  if (res.ok && data.url) {
                                    const next = [...(editData.branding_media?.gallery_urls || [])];
                                    next[idx] = data.url;
                                    setEditData(prev => ({
                                      ...prev,
                                      branding_media: { ...(prev.branding_media || { gallery_urls: [] }), gallery_urls: next }
                                    }));
                                  }
                                } finally {
                                  setUploadingField(null);
                                }
                              }} />
                            </label>
                            <button
                              type="button"
                              className="bg-red-500 text-white px-2 py-1 text-[8px] font-black uppercase"
                              onClick={() => {
                                const next = (editData.branding_media?.gallery_urls || []).filter((_, i) => i !== idx);
                                setEditData(prev => ({
                                  ...prev,
                                  branding_media: { ...(prev.branding_media || { gallery_urls: [] }), gallery_urls: next }
                                }));
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="aspect-square border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 hover:bg-muted/30 transition-all group"
                        onClick={() => {
                          const current = editData.branding_media?.gallery_urls || [];
                          setEditData(prev => ({
                            ...prev,
                            branding_media: { ...(prev.branding_media || { gallery_urls: [] }), gallery_urls: [...current, ""] }
                          }));
                        }}
                      >
                        <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-primary">Add Image</span>
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting || hasPendingRequest}
                  className="bg-primary text-primary-foreground px-12 py-4 rounded-none font-heading font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:opacity-90 disabled:opacity-50 flex items-center gap-3"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Submit Request for Approval
                </button>
              </div>
            </form>
          </div>

          {/* History Sidebar */}
          <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <History className="w-4 h-4" />
              Update History
            </h3>
            <div className="space-y-3">
              {requests.length === 0 ? (
                <p className="text-xs font-bold text-muted-foreground italic border border-dashed border-border p-8 text-center">No update history</p>
              ) : (
                requests.map(r => (
                  <div key={r._id} className="bg-card border border-border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "px-2 py-0.5 text-[8px] font-black uppercase tracking-widest border",
                        r.status === "pending" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                          r.status === "approved" ? "bg-green-500/10 text-green-600 border-green-500/20" :
                            "bg-red-500/10 text-red-600 border-red-500/20"
                      )}>
                        {r.status}
                      </span>
                      <span className="text-[9px] font-bold text-muted-foreground">
                        {new Date(r.requested_at).toLocaleDateString()}
                      </span>
                    </div>
                    {r.admin_notes && (
                      <p className="text-[10px] text-muted-foreground italic border-t border-border pt-2">
                        Admin: "{r.admin_notes}"
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CenterProfileUpdatePage;
