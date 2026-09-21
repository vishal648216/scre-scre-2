import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Globe, Map as MapIcon, MapPin, Loader2, Trash2, ChevronRight, Layers, Plus, MapPinned, Compass } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type GeoItem = { id: string; name: string; code?: string };

function parseBulkNames(raw: string): string[] {
  const parts = raw.split(/[\n,;]+/);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const t = p.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

const AdminLocationsPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [countries, setCountries] = useState<GeoItem[]>([]);
  const [states, setStates] = useState<GeoItem[]>([]);
  const [cities, setCities] = useState<GeoItem[]>([]);
  const [districts, setDistricts] = useState<GeoItem[]>([]);
  const [pincodes, setPincodes] = useState<GeoItem[]>([]);
  const [areas, setAreas] = useState<GeoItem[]>([]);

  const [selectedCountry, setSelectedCountry] = useState<GeoItem | null>(null);
  const [selectedState, setSelectedState] = useState<GeoItem | null>(null);
  const [selectedCity, setSelectedCity] = useState<GeoItem | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<GeoItem | null>(null);
  const [selectedPincode, setSelectedPincode] = useState<GeoItem | null>(null);

  const [countryName, setCountryName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [stateName, setStateName] = useState("");
  const [stateBulk, setStateBulk] = useState("");
  const [cityName, setCityName] = useState("");
  const [cityBulk, setCityBulk] = useState("");
  const [districtName, setDistrictName] = useState("");
  const [districtBulk, setDistrictBulk] = useState("");
  const [pincodeName, setPincodeName] = useState("");
  const [pincodeBulk, setPincodeBulk] = useState("");
  const [areaName, setAreaName] = useState("");
  const [areaBulk, setAreaBulk] = useState("");

  const [saving, setSaving] = useState<string | null>(null);

  const loadCountries = useCallback(async () => {
    const res = await apiFetch("/api/admin/locations/countries");
    if (!res.ok) {
      toast.error("Could not load countries");
      return;
    }
    const data = await res.json();
    setCountries(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadCountries();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCountries]);

  useEffect(() => {
    if (!selectedCountry) {
      setStates([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await apiFetch(`/api/admin/locations/states?country_id=${encodeURIComponent(selectedCountry.id)}`);
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (!cancelled) setStates(Array.isArray(data) ? data : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCountry]);

  useEffect(() => {
    if (!selectedState) {
      setDistricts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await apiFetch(`/api/admin/locations/districts?state_id=${encodeURIComponent(selectedState.id)}`);
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (!cancelled) setDistricts(Array.isArray(data) ? data : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedState]);

  useEffect(() => {
    if (!selectedDistrict) {
      setCities([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await apiFetch(`/api/admin/locations/cities?district_id=${encodeURIComponent(selectedDistrict.id)}`);
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (!cancelled) setCities(Array.isArray(data) ? data : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDistrict]);

  useEffect(() => {
    if (!selectedCity) {
      setPincodes([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await apiFetch(`/api/admin/locations/pincodes?city_id=${encodeURIComponent(selectedCity.id)}`);
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (!cancelled) setPincodes(Array.isArray(data) ? data : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCity]);

  useEffect(() => {
    if (!selectedCountry) {
      setAreas([]);
      return;
    }
    let cancelled = false;
    (async () => {
      let url = "";
      if (selectedPincode) {
        url = `/api/admin/locations/areas?pincode_id=${encodeURIComponent(selectedPincode.id)}`;
      } else if (selectedDistrict) {
        url = `/api/admin/locations/areas?district_id=${encodeURIComponent(selectedDistrict.id)}`;
      } else if (selectedCity) {
        url = `/api/admin/locations/areas?city_id=${encodeURIComponent(selectedCity.id)}`;
      } else if (selectedState) {
        url = `/api/admin/locations/areas?state_id=${encodeURIComponent(selectedState.id)}`;
      } else {
        url = `/api/admin/locations/areas?country_id=${encodeURIComponent(selectedCountry.id)}`;
      }
      const res = await apiFetch(url);
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (!cancelled) setAreas(Array.isArray(data) ? data : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCountry, selectedState, selectedCity, selectedDistrict, selectedPincode]);

  const breadcrumb = useMemo(() => {
    const parts: { label: string; onClick?: () => void }[] = [{
      label: "Countries", onClick: () => {
        setSelectedCountry(null);
        setSelectedState(null);
        setSelectedDistrict(null);
        setSelectedCity(null);
        setSelectedPincode(null);
      }
    }];
    if (selectedCountry) {
      parts.push({
        label: selectedCountry.name,
        onClick: () => {
          setSelectedState(null);
          setSelectedDistrict(null);
          setSelectedCity(null);
          setSelectedPincode(null);
        },
      });
    }
    if (selectedState) {
      parts.push({
        label: selectedState.name,
        onClick: () => {
          setSelectedDistrict(null);
          setSelectedCity(null);
          setSelectedPincode(null);
        },
      });
    }
    if (selectedDistrict) {
      parts.push({
        label: selectedDistrict.name,
        onClick: () => {
          setSelectedCity(null);
          setSelectedPincode(null);
        },
      });
    }
    if (selectedCity) {
      parts.push({
        label: selectedCity.name,
        onClick: () => setSelectedPincode(null),
      });
    }
    if (selectedPincode) {
      parts.push({ label: selectedPincode.name });
    }
    return parts;
  }, [selectedCountry, selectedState, selectedDistrict, selectedCity, selectedPincode]);

  const seedIndia = async () => {
    setSaving("seed");
    try {
      const res = await apiFetch("/api/admin/locations/seed-india", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(j.message || "India dataset updated");
        await loadCountries();
      } else {
        toast.error(j.message || "Seed failed");
      }
    } finally {
      setSaving(null);
    }
  };

  const addCountry = async () => {
    const name = countryName.trim();
    if (!name) return;
    setSaving("country");
    try {
      const res = await apiFetch("/api/admin/locations/countries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, code: countryCode.trim() || undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Country added");
        setCountryName("");
        setCountryCode("");
        await loadCountries();
      } else {
        toast.error(j.message || "Failed");
      }
    } finally {
      setSaving(null);
    }
  };

  const addState = async () => {
    if (!selectedCountry) return;
    const name = stateName.trim();
    if (!name) return;
    setSaving("state");
    try {
      const res = await apiFetch("/api/admin/locations/states", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country_id: selectedCountry.id, name }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("State added");
        setStateName("");
        const r2 = await apiFetch(`/api/admin/locations/states?country_id=${encodeURIComponent(selectedCountry.id)}`);
        if (r2.ok) setStates(await r2.json());
      } else {
        toast.error(j.message || "Failed");
      }
    } finally {
      setSaving(null);
    }
  };

  const bulkStates = async () => {
    if (!selectedCountry) return;
    const names = parseBulkNames(stateBulk);
    if (names.length === 0) {
      toast.error("Paste at least one state name (lines, commas, or semicolons)");
      return;
    }
    setSaving("state-bulk");
    try {
      const res = await apiFetch("/api/admin/locations/states/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country_id: selectedCountry.id, names }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(j.message || "Bulk complete");
        setStateBulk("");
        const r2 = await apiFetch(`/api/admin/locations/states?country_id=${encodeURIComponent(selectedCountry.id)}`);
        if (r2.ok) setStates(await r2.json());
      } else {
        toast.error(j.message || "Bulk failed");
      }
    } finally {
      setSaving(null);
    }
  };



  const addDistrict = async () => {
    if (!selectedState) return;
    const name = districtName.trim();
    if (!name) return;
    setSaving("district");
    try {
      const res = await apiFetch("/api/admin/locations/districts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state_id: selectedState.id, name }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("District added");
        setDistrictName("");
        const r2 = await apiFetch(`/api/admin/locations/districts?state_id=${encodeURIComponent(selectedState.id)}`);
        if (r2.ok) setDistricts(await r2.json());
      } else {
        toast.error(j.message || "Failed");
      }
    } finally {
      setSaving(null);
    }
  };

  const bulkDistricts = async () => {
    if (!selectedState) return;
    const names = parseBulkNames(districtBulk);
    if (names.length === 0) {
      toast.error("Paste at least one district name");
      return;
    }
    setSaving("district-bulk");
    try {
      const res = await apiFetch("/api/admin/locations/districts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state_id: selectedState.id, names }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(j.message || "Bulk complete");
        setDistrictBulk("");
        const r2 = await apiFetch(`/api/admin/locations/districts?state_id=${encodeURIComponent(selectedState.id)}`);
        if (r2.ok) setDistricts(await r2.json());
      } else {
        toast.error(j.message || "Bulk failed");
      }
    } finally {
      setSaving(null);
    }
  };

  const addCity = async () => {
    if (!selectedDistrict) return;
    const name = cityName.trim();
    if (!name) return;
    setSaving("city");
    try {
      const res = await apiFetch("/api/admin/locations/cities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ district_id: selectedDistrict.id, name }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("City added");
        setCityName("");
        const r2 = await apiFetch(`/api/admin/locations/cities?district_id=${encodeURIComponent(selectedDistrict.id)}`);
        if (r2.ok) setCities(await r2.json());
      } else {
        toast.error(j.message || "Failed");
      }
    } finally {
      setSaving(null);
    }
  };

  const bulkCities = async () => {
    if (!selectedDistrict) return;
    const names = parseBulkNames(cityBulk);
    if (names.length === 0) {
      toast.error("Paste at least one city name");
      return;
    }
    setSaving("city-bulk");
    try {
      const res = await apiFetch("/api/admin/locations/cities/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ district_id: selectedDistrict.id, names }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(j.message || "Bulk complete");
        setCityBulk("");
        const r2 = await apiFetch(`/api/admin/locations/cities?district_id=${encodeURIComponent(selectedDistrict.id)}`);
        if (r2.ok) setCities(await r2.json());
      } else {
        toast.error(j.message || "Bulk failed");
      }
    } finally {
      setSaving(null);
    }
  };

  const addPincode = async () => {
    if (!selectedCity) return;
    const name = pincodeName.trim();
    if (!name) return;
    setSaving("pincode");
    try {
      const res = await apiFetch("/api/admin/locations/pincodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city_id: selectedCity.id, name }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Pincode added");
        setPincodeName("");
        const r2 = await apiFetch(`/api/admin/locations/pincodes?city_id=${encodeURIComponent(selectedCity.id)}`);
        if (r2.ok) setPincodes(await r2.json());
      } else {
        toast.error(j.message || "Failed");
      }
    } finally {
      setSaving(null);
    }
  };

  const bulkPincodes = async () => {
    if (!selectedCity) return;
    const names = parseBulkNames(pincodeBulk);
    if (names.length === 0) {
      toast.error("Paste at least one pincode name");
      return;
    }
    setSaving("pincode-bulk");
    try {
      const res = await apiFetch("/api/admin/locations/pincodes/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city_id: selectedCity.id, names }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(j.message || "Bulk complete");
        setPincodeBulk("");
        const r2 = await apiFetch(`/api/admin/locations/pincodes?city_id=${encodeURIComponent(selectedCity.id)}`);
        if (r2.ok) setPincodes(await r2.json());
      } else {
        toast.error(j.message || "Bulk failed");
      }
    } finally {
      setSaving(null);
    }
  };

  const addArea = async () => {
    if (!selectedPincode && !selectedCity) return;
    const name = areaName.trim();
    if (!name) return;
    setSaving("area");
    try {
      const body: any = { name };
      if (selectedPincode) {
        body.pincode_id = selectedPincode.id;
      } else if (selectedCity) {
        body.city_id = selectedCity.id;
      }
      const res = await apiFetch("/api/admin/locations/areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Area / locality added");
        setAreaName("");
        if (selectedCountry) {
          let url = "";
          if (selectedPincode) {
            url = `/api/admin/locations/areas?pincode_id=${encodeURIComponent(selectedPincode.id)}`;
          } else if (selectedDistrict) {
            url = `/api/admin/locations/areas?district_id=${encodeURIComponent(selectedDistrict.id)}`;
          } else if (selectedCity) {
            url = `/api/admin/locations/areas?city_id=${encodeURIComponent(selectedCity.id)}`;
          } else if (selectedState) {
            url = `/api/admin/locations/areas?state_id=${encodeURIComponent(selectedState.id)}`;
          } else {
            url = `/api/admin/locations/areas?country_id=${encodeURIComponent(selectedCountry.id)}`;
          }
          const r2 = await apiFetch(url);
          if (r2.ok) setAreas(await r2.json());
        }
      } else {
        toast.error(j.message || "Failed");
      }
    } finally {
      setSaving(null);
    }
  };

  const bulkAreas = async () => {
    if (!selectedPincode && !selectedCity) return;
    const names = parseBulkNames(areaBulk);
    if (names.length === 0) {
      toast.error("Paste at least one area name");
      return;
    }
    setSaving("area-bulk");
    try {
      const body: any = { names };
      if (selectedPincode) {
        body.pincode_id = selectedPincode.id;
      } else if (selectedCity) {
        body.city_id = selectedCity.id;
      }
      const res = await apiFetch("/api/admin/locations/areas/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(j.message || "Bulk complete");
        setAreaBulk("");
        if (selectedCountry) {
          let url = "";
          if (selectedPincode) {
            url = `/api/admin/locations/areas?pincode_id=${encodeURIComponent(selectedPincode.id)}`;
          } else if (selectedDistrict) {
            url = `/api/admin/locations/areas?district_id=${encodeURIComponent(selectedDistrict.id)}`;
          } else if (selectedCity) {
            url = `/api/admin/locations/areas?city_id=${encodeURIComponent(selectedCity.id)}`;
          } else if (selectedState) {
            url = `/api/admin/locations/areas?state_id=${encodeURIComponent(selectedState.id)}`;
          } else {
            url = `/api/admin/locations/areas?country_id=${encodeURIComponent(selectedCountry.id)}`;
          }
          const r2 = await apiFetch(url);
          if (r2.ok) setAreas(await r2.json());
        }
      } else {
        toast.error(j.message || "Bulk failed");
      }
    } finally {
      setSaving(null);
    }
  };

  const del = async (kind: "country" | "state" | "city" | "district" | "pincode" | "area", id: string) => {
    const msg =
      kind === "country"
        ? "Delete this country and ALL its states, districts, cities, pincodes, and areas?"
        : kind === "state"
          ? "Delete this state and ALL its districts, cities, pincodes, and areas?"
          : kind === "district"
            ? "Delete this district and ALL its cities, pincodes, and areas?"
            : kind === "city"
              ? "Delete this city and ALL its pincodes and areas?"
              : kind === "pincode"
                ? "Delete this pincode and ALL its areas?"
                : "Delete this area?";
    if (!window.confirm(msg)) return;
    const path =
      kind === "country"
        ? `/api/admin/locations/countries/${id}`
        : kind === "state"
          ? `/api/admin/locations/states/${id}`
          : kind === "district"
            ? `/api/admin/locations/districts/${id}`
            : kind === "city"
              ? `/api/admin/locations/cities/${id}`
              : kind === "pincode"
                ? `/api/admin/locations/pincodes/${id}`
                : `/api/admin/locations/areas/${id}`;
    const res = await apiFetch(path, { method: "DELETE" });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      toast.success(j.message || "Deleted");
      if (kind === "country") {
        if (selectedCountry?.id === id) {
          setSelectedCountry(null);
          setSelectedState(null);
          setSelectedDistrict(null);
          setSelectedCity(null);
          setSelectedPincode(null);
        }
        await loadCountries();
      } else if (kind === "state") {
        if (selectedState?.id === id) {
          setSelectedState(null);
          setSelectedDistrict(null);
          setSelectedCity(null);
          setSelectedPincode(null);
        }
        if (selectedCountry) {
          const r2 = await apiFetch(`/api/admin/locations/states?country_id=${encodeURIComponent(selectedCountry.id)}`);
          if (r2.ok) setStates(await r2.json());
        }
      } else if (kind === "district") {
        if (selectedDistrict?.id === id) {
          setSelectedDistrict(null);
          setSelectedCity(null);
          setSelectedPincode(null);
        }
        if (selectedState) {
          const r2 = await apiFetch(`/api/admin/locations/districts?state_id=${encodeURIComponent(selectedState.id)}`);
          if (r2.ok) setDistricts(await r2.json());
        }
      } else if (kind === "city") {
        if (selectedCity?.id === id) {
          setSelectedCity(null);
          setSelectedPincode(null);
        }
        if (selectedDistrict) {
          const r2 = await apiFetch(`/api/admin/locations/cities?district_id=${encodeURIComponent(selectedDistrict.id)}`);
          if (r2.ok) setCities(await r2.json());
        }
      } else if (kind === "pincode") {
        if (selectedPincode?.id === id) {
          setSelectedPincode(null);
        }
        if (selectedCity) {
          const r2 = await apiFetch(`/api/admin/locations/pincodes?city_id=${encodeURIComponent(selectedCity.id)}`);
          if (r2.ok) setPincodes(await r2.json());
        }
      } else {
        if (selectedCountry) {
          let url = "";
          if (selectedPincode) {
            url = `/api/admin/locations/areas?pincode_id=${encodeURIComponent(selectedPincode.id)}`;
          } else if (selectedCity) {
            url = `/api/admin/locations/areas?city_id=${encodeURIComponent(selectedCity.id)}`;
          } else if (selectedDistrict) {
            url = `/api/admin/locations/areas?district_id=${encodeURIComponent(selectedDistrict.id)}`;
          } else if (selectedState) {
            url = `/api/admin/locations/areas?state_id=${encodeURIComponent(selectedState.id)}`;
          } else {
            url = `/api/admin/locations/areas?country_id=${encodeURIComponent(selectedCountry.id)}`;
          }
          const r2 = await apiFetch(url);
          if (r2.ok) setAreas(await r2.json());
        }
      }
    } else {
      toast.error(j.message || "Delete failed");
    }
  };

  const panelClass =
    "rounded-2xl border border-slate-200/70 bg-white/90 backdrop-blur-sm shadow-[0_6px_28px_-10px_rgba(15,23,42,0.1)] overflow-hidden flex flex-col min-h-[420px] max-h-[min(70vh,640px)] flex-shrink-0 w-[320px]";

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="font-medium">{t("Loading locations...")}</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">{t("Locations")}</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium max-w-xl">
              {t("Add a country first, then open it to add states, cities, districts, pincodes, and areas. Use bulk paste to load many at once.")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 border-primary/30 hover:bg-primary/5"
            onClick={() => void seedIndia()}
            disabled={saving === "seed"}
          >
            {saving === "seed" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Globe className="w-4 h-4 mr-2" />}
            {t("Seed India + states")}
          </Button>
        </div>

        <nav className="flex flex-wrap items-center gap-1 text-sm font-semibold text-muted-foreground">
          {breadcrumb.map((b, i) => (
            <span key={`${b.label}-${i}`} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-4 h-4 opacity-50" />}
              {b.onClick ? (
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={b.onClick}
                >
                  {b.label}
                </button>
              ) : (
                <span className="text-foreground">{b.label}</span>
              )}
            </span>
          ))}
        </nav>

        <div className="flex gap-6 overflow-x-auto pb-4">
          {/* Countries */}
          <Card className={panelClass}>
            <CardHeader className="border-b border-border/50 bg-gradient-to-r from-sky-50/60 to-transparent py-4 shrink-0">
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <Globe className="w-4 h-4 text-sky-600" />
                {t("Countries")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex flex-col gap-3 flex-1 min-h-0">
              <div className="space-y-2 shrink-0">
                <Input placeholder={t("Country name")} value={countryName} onChange={(e) => setCountryName(e.target.value)} className="rounded-xl" />
                <Input placeholder={t("Code (optional, e.g. IN)")} value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="rounded-xl" />
                <Button type="button" className="w-full rounded-xl" onClick={() => void addCountry()} disabled={saving === "country"}>
                  {saving === "country" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  {t("Add country")}
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1 pr-1 -mr-1">
                {countries.map((c) => (
                  <div
                    key={c.id}
                    className={cn(
                      "group flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 border transition-all cursor-pointer",
                      selectedCountry?.id === c.id
                        ? "border-primary bg-primary/10 shadow-md"
                        : "border-transparent hover:bg-muted/50 hover:border-border",
                    )}
                    onClick={() => {
                      setSelectedCountry(c);
                      setSelectedState(null);
                      setSelectedDistrict(null);
                      setSelectedCity(null);
                      setSelectedPincode(null);
                    }}
                  >
                    <span className="font-semibold text-sm truncate">
                      {c.name}
                      {c.code ? <span className="text-muted-foreground font-normal ml-1">({c.code})</span> : null}
                    </span>
                    <button
                      type="button"
                      className="p-1.5 rounded-lg text-red-600 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        void del("country", c.id);
                      }}
                      aria-label={`${t("Delete")} ${c.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {countries.length === 0 && (
                  <p className="text-xs text-muted-foreground py-6 text-center">{t("No countries yet. Add one or use \"Seed India\".")}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* States */}
          <Card className={cn(panelClass, !selectedCountry && "opacity-60 pointer-events-none")}>
            <CardHeader className="border-b border-border/50 bg-gradient-to-r from-violet-50/50 to-transparent py-4 shrink-0">
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <MapIcon className="w-4 h-4 text-violet-600" />
                {t("States")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex flex-col gap-3 flex-1 min-h-0">
              {!selectedCountry ? (
                <p className="text-sm text-muted-foreground">{t("Select a country to manage states.")}</p>
              ) : (
                <>
                  <div className="space-y-2 shrink-0">
                    <Input placeholder={t("State name")} value={stateName} onChange={(e) => setStateName(e.target.value)} className="rounded-xl" />
                    <Button type="button" variant="secondary" className="w-full rounded-xl" onClick={() => void addState()} disabled={saving === "state"}>
                      {saving === "state" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      {t("Add state")}
                    </Button>
                    <Textarea
                      placeholder={t("Bulk: one state per line, or separate with commas / semicolons")}
                      value={stateBulk}
                      onChange={(e) => setStateBulk(e.target.value)}
                      className="rounded-xl min-h-[72px] text-sm"
                    />
                    <Button type="button" className="w-full rounded-xl" variant="outline" onClick={() => void bulkStates()} disabled={saving === "state-bulk"}>
                      {saving === "state-bulk" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      {t("Add bulk states")}
                    </Button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1 pr-1 -mr-1">
                    {states.map((s) => (
                      <div
                        key={s.id}
                        className={cn(
                          "group flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 border transition-all cursor-pointer",
                          selectedState?.id === s.id
                            ? "border-violet-500 bg-violet-500/10 shadow-md"
                            : "border-transparent hover:bg-muted/50",
                        )}
                        onClick={() => {
                          setSelectedState(s);
                          setSelectedDistrict(null);
                          setSelectedCity(null);
                          setSelectedPincode(null);
                        }}
                      >
                        <span className="font-medium text-sm truncate">{s.name}</span>
                        <button
                          type="button"
                          className="p-1.5 rounded-lg text-red-600 opacity-0 group-hover:opacity-100 hover:bg-red-500/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            void del("state", s.id);
                          }}
                          aria-label={`${t("Delete")} ${s.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {states.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">{t("No states for this country.")}</p>}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Districts */}
          <Card className={cn(panelClass, !selectedState && "opacity-60 pointer-events-none")}>
            <CardHeader className="border-b border-border/50 bg-gradient-to-r from-cyan-50/50 to-transparent py-4 shrink-0">
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <MapPinned className="w-4 h-4 text-cyan-600" />
                {t("Districts")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex flex-col gap-3 flex-1 min-h-0">
              {!selectedState ? (
                <p className="text-sm text-muted-foreground">{t("Select a state to manage districts.")}</p>
              ) : (
                <>
                  <div className="space-y-2 shrink-0">
                    <Input placeholder={t("District name")} value={districtName} onChange={(e) => setDistrictName(e.target.value)} className="rounded-xl" />
                    <Button type="button" variant="secondary" className="w-full rounded-xl" onClick={() => void addDistrict()} disabled={saving === "district"}>
                      {saving === "district" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      {t("Add district")}
                    </Button>
                    <Textarea
                      placeholder={t("Bulk districts (lines or commas)")}
                      value={districtBulk}
                      onChange={(e) => setDistrictBulk(e.target.value)}
                      className="rounded-xl min-h-[72px] text-sm"
                    />
                    <Button type="button" className="w-full rounded-xl" variant="outline" onClick={() => void bulkDistricts()} disabled={saving === "district-bulk"}>
                      {saving === "district-bulk" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      {t("Add bulk districts")}
                    </Button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1 pr-1 -mr-1">
                    {districts.map((d) => (
                      <div
                        key={d.id}
                        className={cn(
                          "group flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 border transition-all cursor-pointer",
                          selectedDistrict?.id === d.id
                            ? "border-cyan-500 bg-cyan-500/10 shadow-md"
                            : "border-transparent hover:bg-muted/50",
                        )}
                        onClick={() => {
                          setSelectedDistrict(d);
                          setSelectedCity(null);
                          setSelectedPincode(null);
                        }}
                      >
                        <span className="font-medium text-sm truncate">{d.name}</span>
                        <button
                          type="button"
                          className="p-1.5 rounded-lg text-red-600 opacity-0 group-hover:opacity-100 hover:bg-red-500/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            void del("district", d.id);
                          }}
                          aria-label={`${t("Delete")} ${d.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {districts.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">{t("No districts yet.")}</p>}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Cities */}
          <Card className={cn(panelClass, !selectedDistrict && "opacity-60 pointer-events-none")}>
            <CardHeader className="border-b border-border/50 bg-gradient-to-r from-emerald-50/50 to-transparent py-4 shrink-0">
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                {t("Cities")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex flex-col gap-3 flex-1 min-h-0">
              {!selectedDistrict ? (
                <p className="text-sm text-muted-foreground">{t("Select a district to manage cities.")}</p>
              ) : (
                <>
                  <div className="space-y-2 shrink-0">
                    <Input placeholder={t("City name")} value={cityName} onChange={(e) => setCityName(e.target.value)} className="rounded-xl" />
                    <Button type="button" variant="secondary" className="w-full rounded-xl" onClick={() => void addCity()} disabled={saving === "city"}>
                      {saving === "city" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      {t("Add city")}
                    </Button>
                    <Textarea
                      placeholder={t("Bulk cities (lines or commas)")}
                      value={cityBulk}
                      onChange={(e) => setCityBulk(e.target.value)}
                      className="rounded-xl min-h-[72px] text-sm"
                    />
                    <Button type="button" className="w-full rounded-xl" variant="outline" onClick={() => void bulkCities()} disabled={saving === "city-bulk"}>
                      {saving === "city-bulk" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      {t("Add bulk cities")}
                    </Button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1 pr-1 -mr-1">
                    {cities.map((c) => (
                      <div
                        key={c.id}
                        className={cn(
                          "group flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 border transition-all cursor-pointer",
                          selectedCity?.id === c.id
                            ? "border-emerald-500 bg-emerald-500/10 shadow-md"
                            : "border-transparent hover:bg-muted/50",
                        )}
                        onClick={() => {
                          setSelectedCity(c);
                          setSelectedPincode(null);
                        }}
                      >
                        <span className="font-medium text-sm truncate">{c.name}</span>
                        <button
                          type="button"
                          className="p-1.5 rounded-lg text-red-600 opacity-0 group-hover:opacity-100 hover:bg-red-500/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            void del("city", c.id);
                          }}
                          aria-label={`${t("Delete")} ${c.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {cities.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">{t("No cities yet.")}</p>}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Pincodes */}
          <Card className={cn(panelClass, !selectedCity && "opacity-60 pointer-events-none")}>
            <CardHeader className="border-b border-border/50 bg-gradient-to-r from-orange-50/50 to-transparent py-4 shrink-0">
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <Compass className="w-4 h-4 text-orange-600" />
                {t("Pincodes")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex flex-col gap-3 flex-1 min-h-0">
              {!selectedCity ? (
                <p className="text-sm text-muted-foreground">{t("Select a city to manage pincodes.")}</p>
              ) : (
                <>
                  <div className="space-y-2 shrink-0">
                    <Input placeholder={t("Pincode name")} value={pincodeName} onChange={(e) => setPincodeName(e.target.value)} className="rounded-xl" />
                    <Button type="button" variant="secondary" className="w-full rounded-xl" onClick={() => void addPincode()} disabled={saving === "pincode"}>
                      {saving === "pincode" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      {t("Add pincode")}
                    </Button>
                    <Textarea
                      placeholder={t("Bulk pincodes (lines or commas)")}
                      value={pincodeBulk}
                      onChange={(e) => setPincodeBulk(e.target.value)}
                      className="rounded-xl min-h-[72px] text-sm"
                    />
                    <Button type="button" className="w-full rounded-xl" variant="outline" onClick={() => void bulkPincodes()} disabled={saving === "pincode-bulk"}>
                      {saving === "pincode-bulk" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      {t("Add bulk pincodes")}
                    </Button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1 pr-1 -mr-1">
                    {pincodes.map((p) => (
                      <div
                        key={p.id}
                        className={cn(
                          "group flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 border transition-all cursor-pointer",
                          selectedPincode?.id === p.id
                            ? "border-orange-500 bg-orange-500/10 shadow-md"
                            : "border-transparent hover:bg-muted/50",
                        )}
                        onClick={() => setSelectedPincode(p)}
                      >
                        <span className="font-medium text-sm truncate">{p.name}</span>
                        <button
                          type="button"
                          className="p-1.5 rounded-lg text-red-600 opacity-0 group-hover:opacity-100 hover:bg-red-500/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            void del("pincode", p.id);
                          }}
                          aria-label={`${t("Delete")} ${p.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {pincodes.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">{t("No pincodes yet.")}</p>}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Areas */}
          <Card className={cn(panelClass, !selectedCountry && "opacity-60 pointer-events-none")}>
            <CardHeader className="border-b border-border/50 bg-gradient-to-r from-amber-50/50 to-transparent py-4 shrink-0">
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-600" />
                {t("Areas / localities")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex flex-col gap-3 flex-1 min-h-0">
              {!selectedCountry ? (
                <p className="text-sm text-muted-foreground">{t("Select a country to manage areas.")}</p>
              ) : (
                <>
                  <div className="space-y-2 shrink-0">
                    {selectedPincode || selectedCity ? (
                      <>
                        <Input placeholder={t("Area or locality")} value={areaName} onChange={(e) => setAreaName(e.target.value)} className="rounded-xl" />
                        <Button type="button" variant="secondary" className="w-full rounded-xl" onClick={() => void addArea()} disabled={saving === "area"}>
                          {saving === "area" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                          {t("Add area")}
                        </Button>
                        <Textarea
                          placeholder={t("Bulk areas (lines or commas)")}
                          value={areaBulk}
                          onChange={(e) => setAreaBulk(e.target.value)}
                          className="rounded-xl min-h-[72px] text-sm"
                        />
                        <Button type="button" className="w-full rounded-xl" variant="outline" onClick={() => void bulkAreas()} disabled={saving === "area-bulk"}>
                          {saving === "area-bulk" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                          {t("Add bulk areas")}
                        </Button>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t("Select a pincode or city to add new areas; viewing all areas for {country}.", { country: selectedCountry.name })}</p>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1 pr-1 -mr-1">
                    {areas.map((a) => (
                      <div key={a.id} className="group flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 border border-transparent hover:bg-muted/50">
                        <span className="font-medium text-sm truncate">{a.name}</span>
                        <button
                          type="button"
                          className="p-1.5 rounded-lg text-red-600 opacity-0 group-hover:opacity-100 hover:bg-red-500/10"
                          onClick={() => void del("area", a.id)}
                          aria-label={`${t("Delete")} ${a.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {areas.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">{t("No areas yet.")}</p>}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <p className="text-xs text-muted-foreground">
          <Link to="/dashboard/centers" className="text-primary font-semibold hover:underline">
            {t("Center addresses")}
          </Link>{" "}
          {t("can later be wired to pick from this master data; today centers still use free-text city/state fields.")}
        </p>
      </div>
    </DashboardLayout>
  );
};

export default AdminLocationsPage;
