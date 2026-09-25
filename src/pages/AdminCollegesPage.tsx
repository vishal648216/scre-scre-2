import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Loader2, Pencil, Trash2, Building2, Search, X, MapPin, GraduationCap, Award, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface GeoItem {
  id: string;
  name: string;
}

interface College {
  _id: string;
  name: string;
  country_id?: string;
  state_id?: string;
  district_id?: string;
  city_id?: string;
}

const AdminCollegesPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [colleges, setColleges] = useState<College[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingCollege, setEditingCollege] = useState<College | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    country_id: "",
    state_id: "",
    district_id: "",
    city_id: "",
  });
  const [countries, setCountries] = useState<GeoItem[]>([]);
  const [states, setStates] = useState<GeoItem[]>([]);
  const [districts, setDistricts] = useState<GeoItem[]>([]);
  const [cities, setCities] = useState<GeoItem[]>([]);

  const loadColleges = async (search: string = "") => {
    try {
      let url = "/api/admin/colleges";
      if (search) {
        url += `?search=${encodeURIComponent(search)}`;
      }
      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        setColleges(Array.isArray(data) ? data : []);
      } else {
        toast.error("Failed to load colleges");
      }
    } catch {
      toast.error("Failed to load colleges");
    } finally {
      setLoading(false);
    }
  };

  const loadCountries = async () => {
    try {
      const res = await apiFetch("/api/admin/locations/countries");
      if (res.ok) {
        const data = await res.json();
        setCountries(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    }
  };

  const loadStates = async (countryId: string) => {
    try {
      const res = await apiFetch(`/api/admin/locations/states?country_id=${encodeURIComponent(countryId)}`);
      if (res.ok) {
        const data = await res.json();
        setStates(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    }
  };

  const loadDistricts = async (stateId: string) => {
    try {
      const res = await apiFetch(`/api/admin/locations/districts?state_id=${encodeURIComponent(stateId)}`);
      if (res.ok) {
        const data = await res.json();
        setDistricts(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    }
  };

  const loadCities = async (districtId: string) => {
    try {
      const res = await apiFetch(`/api/admin/locations/cities?district_id=${encodeURIComponent(districtId)}`);
      if (res.ok) {
        const data = await res.json();
        setCities(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadColleges();
    loadCountries();
  }, []);

  useEffect(() => {
    if (formData.country_id) {
      loadStates(formData.country_id);
    } else {
      setStates([]);
      setDistricts([]);
      setCities([]);
    }
  }, [formData.country_id]);

  useEffect(() => {
    if (formData.state_id) {
      loadDistricts(formData.state_id);
    } else {
      setDistricts([]);
      setCities([]);
    }
  }, [formData.state_id]);

  useEffect(() => {
    if (formData.district_id) {
      loadCities(formData.district_id);
    } else {
      setCities([]);
    }
  }, [formData.district_id]);

  const resetForm = () => {
    setFormData({
      name: "",
      country_id: "",
      state_id: "",
      district_id: "",
      city_id: "",
    });
    setEditingCollege(null);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Please enter a college/partner name");
      return;
    }
    try {
      const payload = {
        name: formData.name.trim(),
        country_id: formData.country_id || undefined,
        state_id: formData.state_id || undefined,
        district_id: formData.district_id || undefined,
        city_id: formData.city_id || undefined,
      };

      let res;
      if (isEditing && editingCollege) {
        res = await apiFetch(`/api/admin/colleges/${editingCollege._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await apiFetch("/api/admin/colleges", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        toast.success(isEditing ? "College updated successfully" : "College registered successfully");
        setIsAdding(false);
        setIsEditing(false);
        resetForm();
        loadColleges(searchQuery);
      } else {
        toast.error("Failed to save college");
      }
    } catch {
      toast.error("Failed to save college");
    }
  };

  const handleEdit = (college: College) => {
    setEditingCollege(college);
    setFormData({
      name: college.name,
      country_id: college.country_id || "",
      state_id: college.state_id || "",
      district_id: college.district_id || "",
      city_id: college.city_id || "",
    });
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this college?")) return;
    try {
      const res = await apiFetch(`/api/admin/colleges/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("College deleted successfully");
        loadColleges(searchQuery);
      } else {
        toast.error("Failed to delete college");
      }
    } catch {
      toast.error("Failed to delete college");
    }
  };

  const getLocationName = (id: string | undefined, list: GeoItem[]): string => {
    if (!id) return "—";
    const item = list.find((i) => i.id === id);
    return item?.name || "—";
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 pb-12">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl border border-indigo-500/20 shadow-xl">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-1">
              <Building2 className="w-4 h-4" /> Academic & Placement Network
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Colleges & IT Placement Partners
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Manage institutions, university tie-ups, and corporate training centers for student allotment.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => {
                resetForm();
                setIsAdding(true);
              }}
              className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Partner Institution
            </Button>
          </div>
        </div>

        {/* Directory Card */}
        <Card className="rounded-2xl border border-slate-800 bg-slate-950/80 backdrop-blur-xl shadow-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-800/80 py-4 px-6 bg-slate-900/50">
            <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-200 flex items-center gap-2 uppercase tracking-wider">
                <GraduationCap className="w-4 h-4 text-cyan-400" /> College Directory ({colleges.length})
              </CardTitle>
              <div className="relative min-w-[280px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search college name..."
                  className="pl-9 pr-9 py-2 bg-slate-900 border border-slate-700 text-slate-200 rounded-xl text-xs font-medium focus:border-cyan-500 outline-none"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    loadColleges(e.target.value);
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      loadColleges("");
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {loading ? (
              <div className="p-16 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                <span className="text-xs text-slate-400 font-medium">Loading Institution Network...</span>
              </div>
            ) : colleges.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No colleges or partner institutions found.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {colleges.map((c) => (
                  <div
                    key={c._id}
                    className="bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 p-5 rounded-2xl shadow-lg transition-all group relative"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(c)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(c._id)}
                          className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h3 className="font-bold text-white text-base mt-3 leading-snug">{c.name}</h3>

                    <div className="mt-3 text-xs text-slate-400 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                      <span>
                        {[
                          getLocationName(c.city_id, cities),
                          getLocationName(c.state_id, states),
                          getLocationName(c.country_id, countries),
                        ]
                          .filter((x) => x !== "—")
                          .join(", ") || "Location General"}
                      </span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3 h-3" /> Verified Institution
                      </span>
                      <span className="text-slate-500">Active Network</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ADD / EDIT DIALOG */}
        <Dialog
          open={isAdding || isEditing}
          onOpenChange={(open) => {
            if (!open) {
              setIsAdding(false);
              setIsEditing(false);
              resetForm();
            }
          }}
        >
          <DialogContent className="sm:max-w-lg bg-slate-950 border border-slate-800 text-slate-200">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-cyan-400" />
                {isEditing ? "Edit Institution Details" : "Register New College / Partner"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-3 text-xs">
              <div>
                <Label className="text-slate-400 font-bold block mb-1">College / University Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Delhi Technological University"
                  className="bg-slate-900 border-slate-700 text-slate-200 rounded-xl"
                />
              </div>

              <div>
                <Label className="text-slate-400 font-bold block mb-1">Country</Label>
                <select
                  value={formData.country_id}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      country_id: e.target.value,
                      state_id: "",
                      district_id: "",
                      city_id: "",
                    }))
                  }
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 text-slate-200 rounded-xl text-xs outline-none"
                >
                  <option value="">Select Country</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {formData.country_id && (
                <div>
                  <Label className="text-slate-400 font-bold block mb-1">State</Label>
                  <select
                    value={formData.state_id}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        state_id: e.target.value,
                        district_id: "",
                        city_id: "",
                      }))
                    }
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 text-slate-200 rounded-xl text-xs outline-none"
                  >
                    <option value="">Select State</option>
                    {states.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formData.state_id && (
                <div>
                  <Label className="text-slate-400 font-bold block mb-1">City / District</Label>
                  <select
                    value={formData.district_id}
                    onChange={(e) => setFormData((prev) => ({ ...prev, district_id: e.target.value, city_id: "" }))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 text-slate-200 rounded-xl text-xs outline-none"
                  >
                    <option value="">Select District</option>
                    {districts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <DialogFooter className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setIsAdding(false);
                  setIsEditing(false);
                  resetForm();
                }}
                className="bg-slate-900 border border-slate-800 text-slate-300 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl"
              >
                {isEditing ? "Update Institution" : "Save Institution"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminCollegesPage;
