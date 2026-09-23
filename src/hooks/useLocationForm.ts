import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

export type GeoItem = { id: string; name: string };

export type LocationValues = {
  country: string;
  state: string;
  district: string;
  city: string;
  pincode: string;
};

type UseLocationFormOptions = {
  onValuesChange: (patch: Partial<LocationValues>) => void;
};

export function useLocationForm({ onValuesChange }: UseLocationFormOptions) {
  const [countries, setCountries] = useState<GeoItem[]>([]);
  const [states, setStates] = useState<GeoItem[]>([]);
  const [districts, setDistricts] = useState<GeoItem[]>([]);
  const [cities, setCities] = useState<GeoItem[]>([]);
  const [pincodes, setPincodes] = useState<GeoItem[]>([]);

  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedPincode, setSelectedPincode] = useState<string | null>(null);

  const [customCountry, setCustomCountry] = useState("");
  const [customState, setCustomState] = useState("");
  const [customDistrict, setCustomDistrict] = useState("");
  const [customCity, setCustomCity] = useState("");
  const [customPincode, setCustomPincode] = useState("");

  const hydratingRef = useRef(false);
  const savedRef = useRef<Partial<LocationValues> | null>(null);
  const userChangedRef = useRef(false);

  const matchByName = (items: GeoItem[], name?: string) => {
    const trimmed = String(name || "").trim();
    if (!trimmed) return null;
    return items.find((item) => item.name === trimmed) ?? null;
  };

  const applyOther = (
    level: "country" | "state" | "district" | "city" | "pincode",
    name: string
  ) => {
    switch (level) {
      case "country":
        setSelectedCountry("other");
        setCustomCountry(name);
        break;
      case "state":
        setSelectedState("other");
        setCustomState(name);
        break;
      case "district":
        setSelectedDistrict("other");
        setCustomDistrict(name);
        break;
      case "city":
        setSelectedCity("other");
        setCustomCity(name);
        break;
      case "pincode":
        setSelectedPincode("other");
        setCustomPincode(name);
        break;
    }
    onValuesChange({ [level]: name });
  };

  const resetBelowCountry = useCallback(() => {
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
    onValuesChange({ state: "", district: "", city: "", pincode: "" });
  }, [onValuesChange]);

  const resetBelowState = useCallback(() => {
    setSelectedDistrict(null);
    setSelectedCity(null);
    setSelectedPincode(null);
    setCustomDistrict("");
    setCustomCity("");
    setCustomPincode("");
    setDistricts([]);
    setCities([]);
    setPincodes([]);
    onValuesChange({ district: "", city: "", pincode: "" });
  }, [onValuesChange]);

  const resetBelowDistrict = useCallback(() => {
    setSelectedCity(null);
    setSelectedPincode(null);
    setCustomCity("");
    setCustomPincode("");
    setCities([]);
    setPincodes([]);
    onValuesChange({ city: "", pincode: "" });
  }, [onValuesChange]);

  const resetBelowCity = useCallback(() => {
    setSelectedPincode(null);
    setCustomPincode("");
    setPincodes([]);
    onValuesChange({ pincode: "" });
  }, [onValuesChange]);

  useEffect(() => {
    const loadCountries = async () => {
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
    void loadCountries();
  }, []);

  const hydrateFromSaved = useCallback(
    (values: Partial<LocationValues>) => {
      userChangedRef.current = false;
      hydratingRef.current = true;
      savedRef.current = {
        country: values.country || "",
        state: values.state || "",
        district: values.district || "",
        city: values.city || "",
        pincode: values.pincode || "",
      };

      onValuesChange({
        country: savedRef.current.country,
        state: savedRef.current.state,
        district: savedRef.current.district,
        city: savedRef.current.city,
        pincode: savedRef.current.pincode,
      });

      const countryName = savedRef.current.country;
      if (!countryName) {
        setSelectedCountry(null);
        setCustomCountry("");
        resetBelowCountry();
        hydratingRef.current = false;
        return;
      }

      const country = matchByName(countries, countryName);
      if (country) {
        setSelectedCountry(country.id);
        setCustomCountry("");
      } else {
        applyOther("country", countryName);
        hydratingRef.current = false;
      }
    },
    [countries, onValuesChange, resetBelowCountry]
  );

  useEffect(() => {
    if (!hydratingRef.current || userChangedRef.current || !savedRef.current) return;
    if (!selectedCountry || selectedCountry === "other") return;

    const countryName = savedRef.current.country;
    const country = matchByName(countries, countryName);
    if (!country) return;

    if (selectedCountry !== country.id) return;

    const saved = savedRef.current;
    if (!saved.state) {
      hydratingRef.current = false;
      return;
    }

    const state = matchByName(states, saved.state);
    if (state) {
      setSelectedState(state.id);
      setCustomState("");
    } else if (states.length > 0) {
      applyOther("state", saved.state);
      hydratingRef.current = false;
    }
  }, [countries, selectedCountry, states]);

  useEffect(() => {
    if (!hydratingRef.current || userChangedRef.current || !savedRef.current) return;
    if (!selectedState || selectedState === "other") return;

    const saved = savedRef.current;
    if (!saved.district) {
      if (!saved.city) hydratingRef.current = false;
      return;
    }

    const district = matchByName(districts, saved.district);
    if (district) {
      setSelectedDistrict(district.id);
      setCustomDistrict("");
    } else if (districts.length > 0) {
      applyOther("district", saved.district);
      hydratingRef.current = false;
    }
  }, [selectedState, districts]);

  useEffect(() => {
    if (!hydratingRef.current || userChangedRef.current || !savedRef.current) return;
    if (!selectedDistrict || selectedDistrict === "other") return;

    const saved = savedRef.current;
    if (!saved.city) {
      if (!saved.pincode) hydratingRef.current = false;
      return;
    }

    const city = matchByName(cities, saved.city);
    if (city) {
      setSelectedCity(city.id);
      setCustomCity("");
    } else if (cities.length > 0) {
      applyOther("city", saved.city);
      hydratingRef.current = false;
    }
  }, [selectedDistrict, cities]);

  useEffect(() => {
    if (!hydratingRef.current || userChangedRef.current || !savedRef.current) return;
    if (!selectedCity || selectedCity === "other") return;

    const saved = savedRef.current;
    if (!saved.pincode) {
      hydratingRef.current = false;
      return;
    }

    const pincode = matchByName(pincodes, saved.pincode);
    if (pincode) {
      setSelectedPincode(pincode.id);
      setCustomPincode("");
      hydratingRef.current = false;
      savedRef.current = null;
    } else if (pincodes.length > 0) {
      applyOther("pincode", saved.pincode);
      hydratingRef.current = false;
      savedRef.current = null;
    }
  }, [selectedCity, pincodes]);

  useEffect(() => {
    if (selectedCountry && selectedCountry !== "other") {
      const fetchStates = async () => {
        try {
          const res = await apiFetch(
            `/api/public/locations/states?country_id=${encodeURIComponent(selectedCountry)}`
          );
          if (res.ok) {
            const data = await res.json();
            setStates(Array.isArray(data) ? data : []);
          }
        } catch (error) {
          console.error("Failed to fetch states:", error);
        }
      };
      void fetchStates();
    } else if (!hydratingRef.current) {
      setStates([]);
    }
  }, [selectedCountry]);

  useEffect(() => {
    if (selectedState && selectedState !== "other") {
      const fetchDistricts = async () => {
        try {
          const res = await apiFetch(
            `/api/public/locations/districts?state_id=${encodeURIComponent(selectedState)}`
          );
          if (res.ok) {
            const data = await res.json();
            setDistricts(Array.isArray(data) ? data : []);
          }
        } catch (error) {
          console.error("Failed to fetch districts:", error);
        }
      };
      void fetchDistricts();
    } else if (!hydratingRef.current) {
      setDistricts([]);
    }
  }, [selectedState]);

  useEffect(() => {
    if (selectedDistrict && selectedDistrict !== "other") {
      const fetchCities = async () => {
        try {
          const res = await apiFetch(
            `/api/public/locations/cities?district_id=${encodeURIComponent(selectedDistrict)}`
          );
          if (res.ok) {
            const data = await res.json();
            setCities(Array.isArray(data) ? data : []);
          }
        } catch (error) {
          console.error("Failed to fetch cities:", error);
        }
      };
      void fetchCities();
    } else if (!hydratingRef.current) {
      setCities([]);
    }
  }, [selectedDistrict]);

  useEffect(() => {
    if (selectedCity && selectedCity !== "other") {
      const fetchPincodes = async () => {
        try {
          const res = await apiFetch(
            `/api/public/locations/pincodes?city_id=${encodeURIComponent(selectedCity)}`
          );
          if (res.ok) {
            const data = await res.json();
            setPincodes(Array.isArray(data) ? data : []);
          }
        } catch (error) {
          console.error("Failed to fetch pincodes:", error);
        }
      };
      void fetchPincodes();
    } else if (!hydratingRef.current) {
      setPincodes([]);
    }
  }, [selectedCity]);

  const handleCountryChange = (value: string) => {
    userChangedRef.current = true;
    hydratingRef.current = false;
    savedRef.current = null;
    setSelectedCountry(value || null);
    setCustomCountry("");
    resetBelowCountry();

    if (!value) {
      onValuesChange({ country: "", state: "", district: "", city: "", pincode: "" });
      return;
    }
    if (value === "other") {
      onValuesChange({ country: "", state: "", district: "", city: "", pincode: "" });
      return;
    }
    const country = countries.find((c) => c.id === value);
    onValuesChange({
      country: country?.name || "",
      state: "",
      district: "",
      city: "",
      pincode: "",
    });
  };

  const handleStateChange = (value: string) => {
    userChangedRef.current = true;
    hydratingRef.current = false;
    savedRef.current = null;
    setSelectedState(value || null);
    setCustomState("");
    resetBelowState();

    if (!value) {
      onValuesChange({ state: "", district: "", city: "", pincode: "" });
      return;
    }
    if (value === "other") {
      onValuesChange({ state: "", district: "", city: "", pincode: "" });
      return;
    }
    const state = states.find((s) => s.id === value);
    onValuesChange({
      state: state?.name || "",
      district: "",
      city: "",
      pincode: "",
    });
  };

  const handleDistrictChange = (value: string) => {
    userChangedRef.current = true;
    hydratingRef.current = false;
    savedRef.current = null;
    setSelectedDistrict(value || null);
    setCustomDistrict("");
    resetBelowDistrict();

    if (!value) {
      onValuesChange({ district: "", city: "", pincode: "" });
      return;
    }
    if (value === "other") {
      onValuesChange({ district: "", city: "", pincode: "" });
      return;
    }
    const district = districts.find((d) => d.id === value);
    onValuesChange({
      district: district?.name || "",
      city: "",
      pincode: "",
    });
  };

  const handleCityChange = (value: string) => {
    userChangedRef.current = true;
    hydratingRef.current = false;
    savedRef.current = null;
    setSelectedCity(value || null);
    setCustomCity("");
    resetBelowCity();

    if (!value) {
      onValuesChange({ city: "", pincode: "" });
      return;
    }
    if (value === "other") {
      onValuesChange({ city: "", pincode: "" });
      return;
    }
    const city = cities.find((c) => c.id === value);
    onValuesChange({
      city: city?.name || "",
      pincode: "",
    });
  };

  const handlePincodeChange = (value: string) => {
    userChangedRef.current = true;
    hydratingRef.current = false;
    savedRef.current = null;
    setSelectedPincode(value || null);
    setCustomPincode("");

    if (!value) {
      onValuesChange({ pincode: "" });
      return;
    }
    if (value === "other") {
      onValuesChange({ pincode: "" });
      return;
    }
    const pincode = pincodes.find((p) => p.id === value);
    onValuesChange({ pincode: pincode?.name || "" });
  };

  const handleCustomCountryChange = (value: string) => {
    userChangedRef.current = true;
    setCustomCountry(value);
    onValuesChange({ country: value });
  };

  const handleCustomStateChange = (value: string) => {
    userChangedRef.current = true;
    setCustomState(value);
    onValuesChange({ state: value });
  };

  const handleCustomDistrictChange = (value: string) => {
    userChangedRef.current = true;
    setCustomDistrict(value);
    onValuesChange({ district: value });
  };

  const handleCustomCityChange = (value: string) => {
    userChangedRef.current = true;
    setCustomCity(value);
    onValuesChange({ city: value });
  };

  const handleCustomPincodeChange = (value: string) => {
    userChangedRef.current = true;
    setCustomPincode(value);
    onValuesChange({ pincode: value });
  };

  const resetAll = useCallback(() => {
    userChangedRef.current = false;
    hydratingRef.current = false;
    savedRef.current = null;
    setSelectedCountry(null);
    setSelectedState(null);
    setSelectedDistrict(null);
    setSelectedCity(null);
    setSelectedPincode(null);
    setCustomCountry("");
    setCustomState("");
    setCustomDistrict("");
    setCustomCity("");
    setCustomPincode("");
    setStates([]);
    setDistricts([]);
    setCities([]);
    setPincodes([]);
  }, []);

  return {
    countries,
    states,
    districts,
    cities,
    pincodes,
    selectedCountry,
    selectedState,
    selectedDistrict,
    selectedCity,
    selectedPincode,
    customCountry,
    customState,
    customDistrict,
    customCity,
    customPincode,
    handleCountryChange,
    handleStateChange,
    handleDistrictChange,
    handleCityChange,
    handlePincodeChange,
    handleCustomCountryChange,
    handleCustomStateChange,
    handleCustomDistrictChange,
    handleCustomCityChange,
    handleCustomPincodeChange,
    hydrateFromSaved,
    resetAll,
  };
}
