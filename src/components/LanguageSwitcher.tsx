import i18n from "@/i18n";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";

// Most common languages for the region + global
const LANG_OPTIONS = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "pa", label: "ਪੰਜਾਬੀ" },
  { code: "ur", label: "اردو" },
  { code: "bn", label: "বাংলা" },
  { code: "mr", label: "मराठी" },
  { code: "gu", label: "ગુજરાતી" },
  { code: "te", label: "తెలుగు" },
  { code: "ta", label: "தமிழ்" },
  { code: "kn", label: "ಕನ್ನಡ" },
  { code: "ml", label: "മലയാളം" },
  { code: "sa", label: "संस्कृतम्" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "ar", label: "العربية" },
  { code: "zh", label: "中文" },
];

const LanguageSwitcher = () => {
  const { t } = useTranslation();

  const handleChange = async (lang: string) => {
    await i18n.changeLanguage(lang);
  };

  const currentLang = (i18n.language || "en").split("-")[0].toLowerCase();

  return (
    <div className="flex items-center gap-1 group">
      <Globe className="h-3.5 w-3.5 text-primary group-hover:rotate-12 transition-transform duration-300" />
      <select
        value={currentLang}
        onChange={(e) => handleChange(e.target.value)}
        className="bg-transparent border-none focus:ring-0 focus:outline-none text-[11px] font-black uppercase tracking-widest cursor-pointer hover:text-primary transition-colors pr-4"
        aria-label="Select Language"
      >
        {LANG_OPTIONS.map((option) => (
          <option key={option.code} value={option.code} className="bg-background text-foreground">
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSwitcher;
