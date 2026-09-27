import React, { useEffect } from "react";
import i18n from "@/i18n";
import { Globe, ChevronDown } from "lucide-react";
import { POPULAR_LANGUAGES, setLanguage, initGoogleTranslateScript } from "@/lib/translator";

export interface LanguageSwitcherProps {
  className?: string;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ className = "" }) => {
  useEffect(() => {
    initGoogleTranslateScript();
  }, []);

  const storedLang = (localStorage.getItem("lang") || i18n.language || "en").trim().toLowerCase();
  
  // Match exact stored code or base code
  const currentLang = POPULAR_LANGUAGES.find(
    (l) => l.code.toLowerCase() === storedLang || storedLang.startsWith(l.code.toLowerCase())
  )?.code || storedLang;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedLang = e.target.value;
    setLanguage(selectedLang);
  };

  const indianLangs = POPULAR_LANGUAGES.filter((l) => l.category === "Indian");
  const worldLangs = POPULAR_LANGUAGES.filter((l) => l.category === "World" || l.category === "Global");

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {/* Official Google Translate Dropdown Widget */}
      <div id="google_translate_element" className="inline-block" />

      {/* Custom Universal Language Selector */}
      <div className="relative inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 px-3 py-1.5 shadow-xs transition-all hover:bg-slate-200/60 dark:hover:bg-slate-700/90">
        <Globe className="w-4 h-4 text-primary shrink-0 mr-2" />
        <select
          value={currentLang}
          onChange={handleChange}
          className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 cursor-pointer focus:outline-none appearance-none pr-4 border-none font-sans uppercase tracking-wide max-w-[150px] truncate"
          aria-label="Select Language"
        >
          <optgroup label="--- All Indian Languages ---" className="bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold">
            {indianLangs.map((option) => (
              <option key={option.code} value={option.code} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold py-1.5 normal-case">
                {option.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="--- World Languages A to Z ---" className="bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold">
            {worldLangs.map((option) => (
              <option key={option.code} value={option.code} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold py-1.5 normal-case">
                {option.label}
              </option>
            ))}
          </optgroup>
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400 pointer-events-none shrink-0 -ml-3" />
      </div>
    </div>
  );
};

export default LanguageSwitcher;
