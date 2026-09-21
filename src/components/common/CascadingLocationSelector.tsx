import React, { useEffect, useState, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import { Label } from '@/components/ui/label';
import { MapPin, Building2, Globe, Compass } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LocationFilters {
  country?: string;
  state?: string;
  city?: string;
  centerId?: string;
}

interface CenterRecord {
  _id: string;
  name: string;
  center_code?: string;
  location?: {
    country?: string;
    state?: string;
    city?: string;
    district?: string;
    address?: string;
  };
  country?: string;
  state?: string;
  city?: string;
}

interface CascadingLocationSelectorProps {
  value?: LocationFilters;
  onChange?: (filters: LocationFilters) => void;
  onCenterSelect?: (centerId: string, centerName: string) => void;
  showCenterSelect?: boolean;
  inline?: boolean;
  className?: string;
}

export const CascadingLocationSelector: React.FC<CascadingLocationSelectorProps> = ({
  value,
  onChange,
  onCenterSelect,
  showCenterSelect = true,
  inline = false,
  className,
}) => {
  const [centers, setCenters] = useState<CenterRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCountry, setSelectedCountry] = useState<string>(value?.country || '');
  const [selectedState, setSelectedState] = useState<string>(value?.state || '');
  const [selectedCity, setSelectedCity] = useState<string>(value?.city || '');
  const [selectedCenter, setSelectedCenter] = useState<string>(value?.centerId || '');

  useEffect(() => {
    const fetchCenters = async () => {
      try {
        setLoading(true);
        const res = await apiFetch('/api/centers');
        if (res.ok) {
          const data = await res.json();
          setCenters(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to load centers for cascading selector:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCenters();
  }, []);

  // Sync with controlled value prop if passed
  useEffect(() => {
    if (value) {
      if (value.country !== undefined) setSelectedCountry(value.country);
      if (value.state !== undefined) setSelectedState(value.state);
      if (value.city !== undefined) setSelectedCity(value.city);
      if (value.centerId !== undefined) setSelectedCenter(value.centerId);
    }
  }, [value]);

  const notifyChange = (updated: LocationFilters) => {
    onChange?.(updated);
  };

  // Derive unique countries
  const countries = useMemo(() => {
    const set = new Set<string>();
    centers.forEach((c) => {
      const country = c.location?.country || c.country || 'India';
      if (country) set.add(country.trim());
    });
    return Array.from(set).sort();
  }, [centers]);

  // Derive states/regions filtered by selected country
  const states = useMemo(() => {
    const set = new Set<string>();
    centers.forEach((c) => {
      const country = c.location?.country || c.country || 'India';
      if (!selectedCountry || country.toLowerCase() === selectedCountry.toLowerCase()) {
        const state = c.location?.state || c.state;
        if (state) set.add(state.trim());
      }
    });
    return Array.from(set).sort();
  }, [centers, selectedCountry]);

  // Derive cities filtered by selected country and state
  const cities = useMemo(() => {
    const set = new Set<string>();
    centers.forEach((c) => {
      const country = c.location?.country || c.country || 'India';
      const state = c.location?.state || c.state;

      const matchCountry = !selectedCountry || country.toLowerCase() === selectedCountry.toLowerCase();
      const matchState = !selectedState || (state && state.toLowerCase() === selectedState.toLowerCase());

      if (matchCountry && matchState) {
        const city = c.location?.city || c.city || c.location?.district;
        if (city) set.add(city.trim());
      }
    });
    return Array.from(set).sort();
  }, [centers, selectedCountry, selectedState]);

  // Derive centers filtered by country, state, city
  const filteredCenters = useMemo(() => {
    return centers.filter((c) => {
      const country = c.location?.country || c.country || 'India';
      const state = c.location?.state || c.state;
      const city = c.location?.city || c.city || c.location?.district;

      if (selectedCountry && country.toLowerCase() !== selectedCountry.toLowerCase()) return false;
      if (selectedState && (!state || state.toLowerCase() !== selectedState.toLowerCase())) return false;
      if (selectedCity && (!city || city.toLowerCase() !== selectedCity.toLowerCase())) return false;
      return true;
    });
  }, [centers, selectedCountry, selectedState, selectedCity]);

  const handleCountryChange = (country: string) => {
    setSelectedCountry(country);
    setSelectedState('');
    setSelectedCity('');
    setSelectedCenter('');
    notifyChange({ country: country || undefined, state: undefined, city: undefined, centerId: undefined });
  };

  const handleStateChange = (state: string) => {
    setSelectedState(state);
    setSelectedCity('');
    setSelectedCenter('');
    notifyChange({
      country: selectedCountry || undefined,
      state: state || undefined,
      city: undefined,
      centerId: undefined,
    });
  };

  const handleCityChange = (city: string) => {
    setSelectedCity(city);
    setSelectedCenter('');
    notifyChange({
      country: selectedCountry || undefined,
      state: selectedState || undefined,
      city: city || undefined,
      centerId: undefined,
    });
  };

  const handleCenterChange = (centerId: string) => {
    setSelectedCenter(centerId);
    notifyChange({
      country: selectedCountry || undefined,
      state: selectedState || undefined,
      city: selectedCity || undefined,
      centerId: centerId || undefined,
    });

    if (centerId) {
      const centerObj = centers.find((c) => String(c._id) === centerId);
      if (centerObj) {
        onCenterSelect?.(centerId, centerObj.name);
      }
    }
  };

  return (
    <div
      className={cn(
        inline ? 'flex flex-wrap items-end gap-3' : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3',
        className
      )}
    >
      {/* 1. Country Selector */}
      <div className={cn('space-y-1.5', inline && 'min-w-[150px] flex-1')}>
        <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
          <Globe className="w-3.5 h-3.5 text-blue-500" />
          Country
        </Label>
        <select
          value={selectedCountry}
          onChange={(e) => handleCountryChange(e.target.value)}
          disabled={loading}
          className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
        >
          <option value="">All Countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* 2. Region / State Selector */}
      <div className={cn('space-y-1.5', inline && 'min-w-[160px] flex-1')}>
        <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
          <Compass className="w-3.5 h-3.5 text-purple-500" />
          State / Region
        </Label>
        <select
          value={selectedState}
          onChange={(e) => handleStateChange(e.target.value)}
          disabled={loading || states.length === 0}
          className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm shadow-sm focus:ring-2 focus:ring-purple-500 focus:outline-none disabled:opacity-50"
        >
          <option value="">All States / Regions</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* 3. City Selector */}
      <div className={cn('space-y-1.5', inline && 'min-w-[150px] flex-1')}>
        <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-emerald-500" />
          City
        </Label>
        <select
          value={selectedCity}
          onChange={(e) => handleCityChange(e.target.value)}
          disabled={loading || cities.length === 0}
          className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm shadow-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:opacity-50"
        >
          <option value="">All Cities</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </div>

      {/* 4. Center Selector */}
      {showCenterSelect && (
        <div className={cn('space-y-1.5', inline && 'min-w-[200px] flex-1')}>
          <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-amber-500" />
            Center ({filteredCenters.length})
          </Label>
          <select
            value={selectedCenter}
            onChange={(e) => handleCenterChange(e.target.value)}
            disabled={loading}
            className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm shadow-sm focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:opacity-50"
          >
            <option value="">All Centers</option>
            {filteredCenters.map((center) => (
              <option key={String(center._id)} value={String(center._id)}>
                {center.name} {center.center_code ? `(${center.center_code})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};

export default CascadingLocationSelector;
