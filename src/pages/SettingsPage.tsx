import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Bell, Lock, Eye, EyeOff, Globe, Save, Loader2, Languages } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";

const LANG_OPTIONS = [
  { code: "en", label: "English (International)" },
  { code: "hi", label: "Hindi (हिंदी)" },
  { code: "fr", label: "French (Français)" },
  { code: "es", label: "Spanish (Español)" },
  { code: "de", label: "German (Deutsch)" },
  { code: "ar", label: "Arabic (العربية)" },
  { code: "zh", label: "Chinese (中文)" },
  { code: "ru", label: "Russian (Русский)" },
  { code: "pt", label: "Portuguese (Português)" },
  { code: "ja", label: "Japanese (日本語)" },
  { code: "ur", label: "Urdu (اردو)" },
  { code: "bn", label: "Bengali (বাংলা)" },
  { code: "mr", label: "Marathi (मराठी)" },
  { code: "te", label: "Telugu (తెలుగు)" },
  { code: "ta", label: "Tamil (தமிழ்)" },
  { code: "gu", label: "Gujarati (ગુજરાતી)" },
  { code: "kn", label: "Kannada (ಕನ್ನಡ)" },
  { code: "ml", label: "Malayalam (മലയാളം)" },
  { code: "pa", label: "Punjabi (ਪੰਜਾਬੀ)" },
  { code: "it", label: "Italian (Italiano)" },
  { code: "ko", label: "Korean (한국어)" },
  { code: "tr", label: "Turkish (Türkçe)" },
  { code: "vi", label: "Vietnamese (Tiếng Việt)" },
  { code: "th", label: "Thai (ไทย)" },
  { code: "pl", label: "Polish (Polski)" },
  { code: "nl", label: "Dutch (Nederlands)" },
  { code: "id", label: "Indonesian (Bahasa Indonesia)" },
  { code: "ms", label: "Malay (Bahasa Melayu)" },
  { code: "fa", label: "Persian (فارسی)" },
  { code: "he", label: "Hebrew (עברית)" },
  { code: "el", label: "Greek (Ελληνικά)" },
  { code: "sv", label: "Swedish (Svenska)" },
  { code: "no", label: "Norwegian (Norsk)" },
  { code: "da", label: "Danish (Dansk)" },
  { code: "fi", label: "Finnish (Suomi)" },
  { code: "cs", label: "Czech (Čeština)" },
  { code: "hu", label: "Hungarian (Magyar)" },
  { code: "ro", label: "Romanian (Română)" },
  { code: "sk", label: "Slovak (Slovenčina)" },
  { code: "uk", label: "Ukrainian (Українська)" },
  { code: "bg", label: "Bulgarian (Български)" },
  { code: "hr", label: "Croatian (Hrvatski)" },
  { code: "sr", label: "Serbian (Српски)" },
  { code: "sl", label: "Slovenian (Slovenščina)" },
  { code: "et", label: "Estonian (Eesti)" },
  { code: "lv", label: "Latvian (Latviešu)" },
  { code: "lt", label: "Lithuanian (Lietuvių)" },
  { code: "sq", label: "Albanian (Shqip)" },
  { code: "mk", label: "Macedonian (Македонски)" },
  { code: "hy", label: "Armenian (Հայերեն)" },
  { code: "ka", label: "Georgian (ქართული)" },
  { code: "az", label: "Azerbaijani (Azərbaycanca)" },
  { code: "uz", label: "Uzbek (Oʻzbekcha)" },
  { code: "kk", label: "Kazakh (Қазақша)" },
  { code: "sw", label: "Swahili (Kiswahili)" },
  { code: "am", label: "Amharic (አማርኛ)" },
  { code: "km", label: "Khmer (ភាសាខ្មែរ)" },
  { code: "mi", label: "Maori (Māori)" },
  { code: "fj", label: "Fijian (Na Vosa Vakaviti)" },
  { code: "to", label: "Tongan (Lea Faka-Tonga)" },
  { code: "sm", label: "Samoan (Gagana Samoa)" },
  { code: "haw", label: "Hawaiian (ʻŌlelo Hawaiʻi)" },
  { code: "mg", label: "Malagasy (Fiteny Malagasy)" },
  { code: "ny", label: "Chichewa (Chichewa)" },
  { code: "xh", label: "Xhosa (isiXhosa)" },
  { code: "zu", label: "Zulu (isiZulu)" },
  { code: "st", label: "Sesotho (Sesotho)" },
  { code: "tn", label: "Tswana (Setswana)" },
  { code: "ts", label: "Tsonga (Xitsonga)" },
  { code: "ss", label: "Swati (SiSwati)" },
  { code: "nr", label: "Ndebele (isiNdebele)" },
  { code: "ve", label: "Venda (Tshivenda)" },
  { code: "jv", label: "Javanese (Basa Jawa)" },
  { code: "su", label: "Sundanese (Basa Sunda)" },
  { code: "ceb", label: "Cebuano (Pinulongan)" },
  { code: "tl", label: "Tagalog (Wikang Tagalog)" },
  { code: "ga", label: "Irish (Gaeilge)" },
  { code: "cy", label: "Welsh (Cymraeg)" },
  { code: "br", label: "Breton (Brezhoneg)" },
  { code: "sco", label: "Scots (Scots)" },
  { code: "gd", label: "Scottish Gaelic (Gàidhlig)" },
  { code: "is", label: "Icelandic (Íslenska)" },
  { code: "fo", label: "Faroese (Føroyskt)" },
  { code: "eu", label: "Basque (Euskara)" },
  { code: "oc", label: "Occitan (Occitan)" },
  { code: "ca", label: "Catalan (Català)" },
  { code: "gl", label: "Galician (Galego)" },
  { code: "jct", label: "Krymchak (Qrymçaqça)" },
  { code: "wa", label: "Walloon (Walon)" },
  { code: "fy", label: "Frisian (Frysk)" },
  { code: "lb", label: "Luxembourgish (Lëtzebuergesch)" },
  { code: "csb", label: "Kashubian (Kaszëbsczi)" },
  { code: "mwl", label: "Mirandese (Mirandés)" },
  { code: "an", label: "Aragonese (Aragonés)" },
  { code: "co", label: "Corsican (Corsu)" },
  { code: "fur", label: "Friulian (Furlan)" },
  { code: "lld", label: "Ladin (Ladin)" },
  { code: "lij", label: "Ligurian (Ligur)" },
  { code: "lmo", label: "Lombard (Lombard)" },
  { code: "pms", label: "Piedmontese (Piemontèis)" },
  { code: "sc", label: "Sardinian (Sardu)" },
  { code: "scn", label: "Sicilian (Sicilianu)" },
  { code: "vec", label: "Venetian (Vèneto)" },
  { code: "szl", label: "Silesian (Silesian)" },
  { code: "dsb", label: "Lower Sorbian (Dolnoserbski)" },
  { code: "hsb", label: "Upper Sorbian (Hornjoserbsce)" },
  { code: "krl", label: "Karelian (Karelian)" },
  { code: "vep", label: "Veps (Veps)" },
  { code: "vro", label: "Võro (Võro)" },
  { code: "gil", label: "Gilbertese (Gilbertese)" },
  { code: "pau", label: "Palauan (Palauan)" },
  { code: "pon", label: "Pohnpeian (Pohnpeian)" },
  { code: "ay", label: "Aymara (Aymar aru)" },
  { code: "qu", label: "Quechua (Runasimi)" },
  { code: "gn", label: "Guarani (Avañe'ẽ)" },
  { code: "iu", label: "Inuktitut (Inuktitut)" },
  { code: "kl", label: "Greenlandic (Kalaallisut)" },
  { code: "se", label: "Sami (Sámegiella)" },
  { code: "bo", label: "Tibetan (བོད་སྐད།)" },
  { code: "dz", label: "Dzongkha (རྫོང་ཁ།)" },
  { code: "lo", label: "Lao (ລາວ)" },
  { code: "my", label: "Burmese (မြန်မာဘာသာ)" },
  { code: "mn", label: "Mongolian (Монгол хэл)" },
  { code: "tt", label: "Tatar (Татарча)" },
  { code: "ba", label: "Bashkir (Башҡортса)" },
  { code: "cv", label: "Chuvash (Чӑвашла)" },
  { code: "ce", label: "Chechen (Нохчийн)" },
  { code: "os", label: "Ossetic (Ирон)" },
  { code: "ab", label: "Abkhazian (Аԥсшәа)" },
  { code: "av", label: "Avaric (МагӀарул мацӀ)" },
  { code: "kbd", label: "Kabardian (Адыгэбзэ)" },
  { code: "inh", label: "Ingush (ГӀалгӀай мотт)" },
  { code: "ady", label: "Adyghe (Адыгабзэ)" },
  { code: "xal", label: "Kalmyk (Хальмг келн)" },
  { code: "bua", label: "Buryat (Буряад хэлэн)" },
  { code: "sah", label: "Yakut (Саха тыла)" },
  { code: "tyv", label: "Tuvinian (Тыва дыл)" },
  { code: "yo", label: "Yoruba (Yorùbá)" },
  { code: "ig", label: "Igbo (Igbo)" },
  { code: "ha", label: "Hausa (Hausa)" },
  { code: "so", label: "Somali (Soomaali)" },
  { code: "om", label: "Oromo (Oromoo)" },
  { code: "rw", label: "Kinyarwanda (Kinyarwanda)" },
  { code: "rn", label: "Kirundi (Kirundi)" },
  { code: "lg", label: "Luganda (Luganda)" },
  { code: "wo", label: "Wolof (Wolof)" },
  { code: "bm", label: "Bambara (Bamanankan)" },
  { code: "ff", label: "Fulani (Fulfulde)" },
  { code: "ak", label: "Akan (Akan)" },
  { code: "sn", label: "Shona (ChiShona)" },
  { code: "ti", label: "Tigrinya (ትግርኛ)" },
  { code: "dv", label: "Maldivian (ދިވެހި)" },
  { code: "si", label: "Sinhala (සිංහල)" },
  { code: "ne", label: "Nepali (नेपाली)" },
  { code: "ps", label: "Pashto (پښتو)" },
  { code: "sd", label: "Sindhi (سنڌي)" },
  { code: "bal", label: "Balochi (بلوچی)" },
  { code: "ku", label: "Kurdish (Kurdî)" },
  { code: "as", label: "Assamese (অসমীয়া)" },
  { code: "or", label: "Odia (ଓଡ଼ିଆ)" },
  { code: "sa", label: "Sanskrit (संस्कृतम्)" },
  { code: "mai", label: "Maithili (मैथिली)" },
  { code: "kok", label: "Konkani (कोंकणी)" },
  { code: "mni", label: "Manipuri (মণিপুরী)" },
  { code: "doi", label: "Dogri (डोगरी)" },
  { code: "ks", label: "Kashmiri (کٲشُر)" },
  { code: "sat", label: "Santali (সাঁতালি)" },
  { code: "brx", label: "Bodo (बर')" },
  { code: "tcy", label: "Tulu (ತುಳು)" },
  { code: "kfa", label: "Kodava (ಕೊಡವ)" },
  { code: "bgc", label: "Haryanvi (हरियाणवी)" },
  { code: "raj", label: "Rajasthani (राजस्थानी)" },
  { code: "bho", label: "Bhojpuri (भोजपुरी)" },
  { code: "mag", label: "Magahi (मगही)" },
  { code: "awa", label: "Awadhi (अवधी)" },
  { code: "mwr", label: "Marwari (मारवाड़ी)" },
  { code: "mtr", label: "Mewari (मेवाड़ी)" },
  { code: "swv", label: "Shekhawati (शेखावाटी)" },
  { code: "bgq", label: "Bagri (बागड़ी)" },
  { code: "gbm", label: "Garhwali (गढ़वाली)" },
  { code: "kfy", label: "Kumaoni (कुमाऊँनी)" },
  { code: "bns", label: "Bundeli (बुंदेली)" },
  { code: "mup", label: "Malvi (मालवी)" },
  { code: "noe", label: "Nimadi (निमाड़ी)" },
  { code: "bra", label: "Braj Bhasha (ब्रज भाषा)" },
  { code: "anp", label: "Angika (অঙ্গিকা)" },
  { code: "kht", label: "Khortha (खोरठा)" },
  { code: "tk", label: "Turkmen (Türkmen dili)" },
  { code: "tg", label: "Tajik (Тоҷикӣ)" },
  { code: "ky", label: "Kyrgyz (Кыргызча)" },
  { code: "la", label: "Latin (Latina)" },
  { code: "cor", label: "Cornish (Kernowek)" },
  { code: "bre", label: "Breton (Brezhoneg)" },
  { code: "arg", label: "Aragonese (Aragonés)" },
  { code: "lim", label: "Limburgish (Limburgs)" },
  { code: "ltz", label: "Luxembourgish (Lëtzebuergesch)" },
  { code: "kas", label: "Kashubian (Kaszëbsczi)" },
  { code: "gag", label: "Gagauz (Gagauz)" },
  { code: "sgh", label: "Shughni (Shughni)" },
  { code: "bej", label: "Beja (Beja)" },
  { code: "kau", label: "Kanuri (Kanuri)" },
  { code: "dje", label: "Zarma (Zarma)" },
  { code: "ee", label: "Ewe (Ewe)" },
  { code: "ddn", label: "Dendi (Dendi)" },
  { code: "fon", label: "Fon (Fon)" },
  { code: "snk", label: "Soninke (Soninke)" },
  { code: "fuc", label: "Pulaar (Pulaar)" },
  { code: "mnk", label: "Mandinka (Mandinka)" },
  { code: "dyu", label: "Dyula (Dyula)" },
  { code: "mey", label: "Hassaniya (Hassaniya)" },
  { code: "taq", label: "Tamasheq (Tamasheq)" },
  { code: "ful", label: "Fula (Fula)" },
];

const SettingsPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleLanguageChange = async (lang: string) => {
    await i18n.changeLanguage(lang);
    toast.success(t("Language changed successfully"));
  };

  const handleSave = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success(t("Settings saved successfully"));
    }, 1000);
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">{t("System Settings")}</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">{t("Configure your account preferences and notification controls.")}</p>
        </div>

        <div className="space-y-6">
          {/* Password Section */}
          <Card className="rounded-none border-border shadow-md">
            <CardHeader className="bg-muted/30 border-b border-border py-4">
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary" />
                {t("Security & Password")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("New Password")}</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      placeholder="••••••••" 
                      className="w-full pl-4 pr-10 py-3 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                    />
                    <button 
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Confirm Password")}</label>
                  <div className="relative">
                    <input 
                      type={showConfirm ? "text" : "password"} 
                      placeholder="••••••••" 
                      className="w-full pl-4 pr-10 py-3 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                    />
                    <button 
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preferences Section */}
          <Card className="rounded-none border-border shadow-md">
            <CardHeader className="bg-muted/30 border-b border-border py-4">
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                {t("System Preferences")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <Bell className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide">{t("Email Notifications")}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-medium">{t("Receive alerts about center activities.")}</p>
                  </div>
                </div>
                <div className="w-10 h-5 bg-primary relative rounded-none cursor-pointer">
                  <div className="absolute right-1 top-1 w-3 h-3 bg-white" />
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <Languages className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide">{t("Interface Language")}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-medium">{t("System default is English (International).")}</p>
                  </div>
                </div>
                <select 
                  value={(i18n.language || "en").split("-")[0]}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="bg-transparent border border-border rounded-none px-4 py-2 text-xs font-bold uppercase tracking-wider focus:outline-none focus:border-primary"
                >
                  {LANG_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code} className="bg-background text-foreground">
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <button 
              onClick={handleSave}
              disabled={loading}
              className="bg-primary text-primary-foreground px-10 py-4 rounded-none font-heading font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t("Save All Settings")}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
