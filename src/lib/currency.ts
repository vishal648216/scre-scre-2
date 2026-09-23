import { apiFetch } from "./api";

export interface CountryFeeRule {
  country_code: string;
  country_name: string;
  currency_code: string;
  currency_symbol: string;
  multiplier: number;
}

let cachedRules: CountryFeeRule[] = [
  { country_code: "IN", country_name: "India", currency_code: "INR", currency_symbol: "₹", multiplier: 1.0 },
  { country_code: "US", country_name: "United States", currency_code: "USD", currency_symbol: "$", multiplier: 0.012 },
  { country_code: "EU", country_name: "European Union", currency_code: "EUR", currency_symbol: "€", multiplier: 0.011 },
  { country_code: "AE", country_name: "UAE", currency_code: "AED", currency_symbol: "AED ", multiplier: 0.044 },
  { country_code: "NP", country_name: "Nepal", currency_code: "NPR", currency_symbol: "रु ", multiplier: 1.6 },
];

export async function loadCountryFeeRules(): Promise<CountryFeeRule[]> {
  try {
    const res = await apiFetch("/api/public/country-fees");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.rules) && data.rules.length > 0) {
        cachedRules = data.rules;
      }
    }
  } catch (e) {
    console.error("Failed to load country fee rules:", e);
  }
  return cachedRules;
}

export function formatCurrency(amount: number, countryCodeOrSymbol = "IN"): string {
  const num = Number(amount) || 0;
  // Check if passed string is a symbol directly (e.g., "$", "€", "₹")
  if (countryCodeOrSymbol.length === 1 || countryCodeOrSymbol.startsWith("AED") || countryCodeOrSymbol.startsWith("रु")) {
    return `${countryCodeOrSymbol}${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const rule = cachedRules.find(r => r.country_code.toUpperCase() === countryCodeOrSymbol.toUpperCase()) || cachedRules[0];
  const converted = num * (rule.multiplier || 1.0);
  return `${rule.currency_symbol}${converted.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
