import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Building2,
  Search,
  X,
  MapPin
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
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
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const [editingCollege, setEditingCollege] = useState<College | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    country_id: "",
    state_id: "",
    district_id: "",
    city_id: ""
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
        console.log("LOAD_COLLEGES_RESPONSE", data);
        const collegesData = Array.isArray(data) ? data : [];
        console.log("SET_COLLEGES_CALLED", collegesData);
        setColleges(collegesData);
      } else {
        toast.error("Failed to load colleges");
      }
    } catch (error) {
      console.error("Failed to load colleges:", error);
      toast.error("Failed to load colleges");
    } finally {
      setLoading(false);
    }
  };

  const loadCountries = async (): Promise<GeoItem[]> => {
    try {
      const res = await apiFetch("/api/admin/locations/countries");
      if (res.ok) {
        const data = await res.json();
        const countries = Array.isArray(data) ? data : [];
        setCountries(countries);
        return countries;
      }
    } catch (error) {
      console.error("Failed to load countries:", error);
    }
    return [];
  };

  const loadStates = async (countryId: string): Promise<GeoItem[]> => {
    try {
      const res = await apiFetch(
        `/api/admin/locations/states?country_id=${encodeURIComponent(countryId)}`
      );
      if (res.ok) {
        const data = await res.json();
        const states = Array.isArray(data) ? data : [];
        setStates(states);
        return states;
      }
    } catch (error) {
      console.error("Failed to load states:", error);
    }
    return [];
  };

  const loadDistricts = async (stateId: string): Promise<GeoItem[]> => {
    try {
      const res = await apiFetch(
        `/api/admin/locations/districts?state_id=${encodeURIComponent(stateId)}`
      );
      if (res.ok) {
        const data = await res.json();
        const districts = Array.isArray(data) ? data : [];
        setDistricts(districts);
        return districts;
      }
    } catch (error) {
      console.error("Failed to load districts:", error);
    }
    return [];
  };

  const loadCities = async (districtId: string): Promise<GeoItem[]> => {
    try {
      const res = await apiFetch(
        `/api/admin/locations/cities?district_id=${encodeURIComponent(districtId)}`
      );
      if (res.ok) {
        const data = await res.json();
        const cities = Array.isArray(data) ? data : [];
        setCities(cities);
        return cities;
      }
    } catch (error) {
      console.error("Failed to load cities:", error);
    }
    return [];
  };

  useEffect(() => {
    loadColleges();
    loadCountries();
  }, []);

  useEffect(() => {
    if (isLoadingEdit) return;
    if (formData.country_id) {
      loadStates(formData.country_id);
    } else {
      setStates([]);
      setDistricts([]);
      setCities([]);
    }
  }, [formData.country_id, isLoadingEdit]);

  useEffect(() => {
    if (isLoadingEdit) return;
    if (formData.state_id) {
      loadDistricts(formData.state_id);
    } else {
      setDistricts([]);
      setCities([]);
    }
  }, [formData.state_id, isLoadingEdit]);

  useEffect(() => {
    if (isLoadingEdit) return;
    if (formData.district_id) {
      loadCities(formData.district_id);
    } else {
      setCities([]);
    }
  }, [formData.district_id, isLoadingEdit]);

  const resetForm = () => {
    setFormData({
      name: "",
      country_id: "",
      state_id: "",
      district_id: "",
      city_id: ""
    });
    setEditingCollege(null);
  };

  const handleSubmit = async () => {
    try {
      // Process payload: convert empty strings to undefined for location fields
      const payload = {
        name: formData.name,
        country_id: formData.country_id ? formData.country_id : undefined,
        state_id: formData.state_id ? formData.state_id : undefined,
        district_id: formData.district_id ? formData.district_id : undefined,
        city_id: formData.city_id ? formData.city_id : undefined
      };

      // Log exact payload
      console.log("Submitting college payload:", payload);

      let res;
      if (isEditing && editingCollege) {
        res = await apiFetch(`/api/admin/colleges/${editingCollege._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } else {
        res = await apiFetch("/api/admin/colleges", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        toast.success(
          isEditing ? "College updated successfully" : "College created successfully"
        );
        setIsAdding(false);
        setIsEditing(false);
        resetForm();

        // Reload colleges and verify the updated record exists
        await loadColleges(searchQuery);
        console.log("Colleges after reload:", colleges);
      } else {
        const errorText = await res.text();
        console.error("Failed to save college - response:", errorText);
        toast.error("Failed to save college");
      }
    } catch (error) {
      console.error("Failed to save college:", error);
      toast.error("Failed to save college");
    }
  };

  const handleEdit = async (college: College) => {
    setIsLoadingEdit(true);
    setEditingCollege(college);

    // Step 1: Set initial form data with just name and country_id first
    setFormData({
      name: college.name,
      country_id: college.country_id || "",
      state_id: "",
      district_id: "",
      city_id: ""
    });

    // Step 2: Load states for country
    if (college.country_id) {
      await loadStates(college.country_id);

      // Step 3: Set state_id
      setFormData((prev) => ({ ...prev, state_id: college.state_id || "" }));

      // Step 4: Load districts for state
      if (college.state_id) {
        await loadDistricts(college.state_id);

        // Step 5: Set district_id
        setFormData((prev) => ({ ...prev, district_id: college.district_id || "" }));

        // Step 6: Load cities for district
        if (college.district_id) {
          await loadCities(college.district_id);

          // Step 7: Set city_id
          setFormData((prev) => ({ ...prev, city_id: college.city_id || "" }));
        }
      }
    }

    // Final step: Open edit modal and release flag
    setIsEditing(true);
    setIsLoadingEdit(false);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await apiFetch(`/api/admin/colleges/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        toast.success("College deleted successfully");
        loadColleges(searchQuery);
      } else {
        toast.error("Failed to delete college");
      }
    } catch (error) {
      console.error("Failed to delete college:", error);
      toast.error("Failed to delete college");
    }
  };

  const getLocationName = (
    id: string | undefined,
    list: GeoItem[]
  ): string => {
    if (!id) return "—";
    const item = list.find((i) => i.id === id);
    return item?.name || "—";
  };

  {
    (() => {
      console.log("RENDER_COLLEGES", colleges);
      console.log("SEARCH_QUERY", searchQuery);
      console.log("DEBUG RENDER:");
      console.log("  loading:", loading);
      console.log("  searchQuery:", JSON.stringify(searchQuery));
      console.log("  colleges.length:", colleges.length);
      console.log("  colleges:", JSON.stringify(colleges, null, 2));
      return null;
    })()
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
              {t("Manage Colleges")}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              {t("Add, edit, and delete college information.")}
            </p>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t("Search colleges...")}
                className="pl-9 rounded-xl"
                value={searchQuery}
                onChange={(e) => {
                  console.log("DEBUG search onChange:", e.target.value);
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <Button
              onClick={() => {
                resetForm();
                setIsAdding(true);
              }}
              className="rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t("Add College")}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-4">
            {colleges.map((college, index) => {
              console.log(`DEBUG rendering college index ${index}:`, JSON.stringify(college, null, 2));
              return (
                <Card
                  key={college._id}
                  className="rounded-xl border-border shadow-sm overflow-hidden"
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-5 h-5 text-primary" />
                          <h3 className="text-lg font-bold text-foreground">
                            {college.name}
                          </h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {college.country_id && (
                            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {getLocationName(college.country_id, countries)}
                            </span>
                          )}
                          {college.state_id && (
                            <span className="text-xs font-medium text-muted-foreground">
                              {getLocationName(college.state_id, states)}
                            </span>
                          )}
                          {college.district_id && (
                            <span className="text-xs font-medium text-muted-foreground">
                              {getLocationName(college.district_id, districts)}
                            </span>
                          )}
                          {college.city_id && (
                            <span className="text-xs font-medium text-muted-foreground">
                              {getLocationName(college.city_id, cities)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleEdit(college)}
                          className="rounded-lg"
                        >
                          <Pencil className="w-4 h-4 mr-1" />
                          {t("Edit")}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(college._id)}
                          className="rounded-lg"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          {t("Delete")}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {colleges.length === 0 && !loading && (
              <Card className="rounded-xl border-border shadow-sm">
                <CardContent className="p-12 text-center">
                  <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-foreground mb-2">
                    {t("No colleges yet")}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    {t("Add your first college to get started.")}
                  </p>
                  <Button
                    onClick={() => {
                      resetForm();
                      setIsAdding(true);
                    }}
                    className="rounded-lg"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t("Add College")}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

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
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-lg font-black uppercase tracking-widest">
                {isEditing ? t("Edit College") : t("Add College")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest">
                  {t("College Name")}
                </Label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder={t("Enter college name")}
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest">
                  {t("Country")}
                </Label>
                <select
                  value={formData.country_id}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      country_id: e.target.value,
                      state_id: "",
                      district_id: "",
                      city_id: ""
                    }))
                  }
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">{t("Select country")}</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              {formData.country_id && (
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest">
                    {t("State")}
                  </Label>
                  <select
                    value={formData.state_id}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        state_id: e.target.value,
                        district_id: "",
                        city_id: ""
                      }))
                    }
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">{t("Select state")}</option>
                    {states.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {formData.state_id && (
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest">
                    {t("District")}
                  </Label>
                  <select
                    value={formData.district_id}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        district_id: e.target.value,
                        city_id: ""
                      }))
                    }
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">{t("Select district")}</option>
                    {districts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {formData.district_id && (
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest">
                    {t("City")}
                  </Label>
                  <select
                    value={formData.city_id}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, city_id: e.target.value }))
                    }
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">{t("Select city")}</option>
                    {cities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsAdding(false);
                  setIsEditing(false);
                  resetForm();
                }}
                className="rounded-lg"
              >
                {t("Cancel")}
              </Button>
              <Button
                onClick={handleSubmit}
                className="rounded-lg"
              >
                {isEditing ? t("Update College") : t("Add College")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminCollegesPage;
