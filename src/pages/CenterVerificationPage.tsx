import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Building2, 
  Search, 
  MapPin, 
  User, 
  Phone, 
  Mail, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Printer, 
  ShieldCheck, 
  QrCode,
  ExternalLink 
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { normalizeAssetUrl } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export default function CenterVerificationPage() {
  const { t } = useTranslation();
  const [centerCode, setCenterCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [center, setCenter] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = centerCode.trim();
    if (!cleanCode) return;

    setLoading(true);
    setError(null);
    setCenter(null);

    try {
      const res = await apiFetch(`/api/public/centers/${cleanCode}`);
      const data = await res.json();

      if (res.ok && data.success && data.data) {
        setCenter(data.data);
      } else {
        // Fallback: search in list of centers
        const listRes = await apiFetch("/api/public/centers");
        const listData = await listRes.json();
        const items = listData?.data || (Array.isArray(listData) ? listData : []);
        const found = items.find((c: any) => 
          (c.code && c.code.toLowerCase() === cleanCode.toLowerCase()) ||
          (c.name && c.name.toLowerCase().includes(cleanCode.toLowerCase()))
        );

        if (found) {
          setCenter(found);
        } else {
          setError(t("No authorized learning center found matching this center code or name."));
        }
      }
    } catch {
      setError(t("Center verification service currently unavailable. Please try again later."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col font-sans">
      <Header />

      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header Banner */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-black uppercase tracking-widest border border-primary/20">
              <ShieldCheck className="w-4 h-4" />
              {t("Center Authorization Portal")}
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
              {t("Center")} <span className="text-primary">{t("Verification")}</span>
            </h1>
            <p className="text-muted-foreground text-sm max-w-xl mx-auto">
              {t("Verify the affiliation, official authorization status, and branch credentials of any Sir Chhotu Ram Education learning center.")}
            </p>
          </div>

          {/* Search Card */}
          <Card className="rounded-3xl border border-border shadow-lg bg-card/90 backdrop-blur-md overflow-hidden">
            <CardHeader className="bg-primary/5 border-b border-border/60 pb-5">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Search className="w-5 h-5 text-primary" />
                {t("Verify Center Affiliation")}
              </CardTitle>
              <CardDescription>
                {t("Enter the unique Center Code (e.g. SCRE-01 or CTR101) or Center Name")}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Input
                    type="text"
                    placeholder="e.g. SCRE-01"
                    value={centerCode}
                    onChange={(e) => setCenterCode(e.target.value)}
                    className="rounded-2xl h-12 text-sm pl-4 pr-10 uppercase font-semibold"
                    required
                  />
                  <QrCode className="w-5 h-5 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                </div>
                <Button 
                  type="submit" 
                  disabled={loading || !centerCode.trim()} 
                  className="rounded-2xl h-12 px-8 font-bold text-xs uppercase tracking-widest gap-2 shadow-md hover:shadow-lg transition-all"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  {t("Verify Center")}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Results Area */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground font-medium">{t("Verifying center credentials...")}</p>
            </div>
          )}

          {!loading && error && (
            <Card className="rounded-3xl border-destructive/30 bg-destructive/5 text-destructive p-6 text-center space-y-2 animate-in fade-in">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto text-destructive">
                <XCircle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base">{t("Verification Unsuccessful")}</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">{error}</p>
            </Card>
          )}

          {!loading && center && (
            <Card className="rounded-3xl border border-emerald-500/30 bg-card shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
              {/* Verified Badge Banner */}
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-base tracking-wide uppercase">
                      {t("Officially Authorized Training Center")}
                    </h2>
                    <p className="text-xs text-emerald-100 font-medium">
                      {t("Certified & affiliated with Sir Chhotu Ram Education")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => window.print()} 
                    className="bg-white/10 hover:bg-white/20 text-white border-white/30 rounded-xl text-xs font-bold gap-1.5 print:hidden"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    {t("Print")}
                  </Button>
                </div>
              </div>

              <CardContent className="p-6 sm:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start border-b border-border pb-6">
                  {/* Logo or Icon */}
                  <div className="w-28 h-28 rounded-2xl overflow-hidden border-2 border-border bg-muted flex items-center justify-center shadow-sm shrink-0 p-2">
                    {center.branding_media?.center_logo_url ? (
                      <img 
                        src={normalizeAssetUrl(center.branding_media.center_logo_url)} 
                        alt={center.name} 
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          e.currentTarget.src = "/images/logo.jpeg";
                        }}
                      />
                    ) : (
                      <Building2 className="w-12 h-12 text-primary" />
                    )}
                  </div>

                  {/* Core Details */}
                  <div className="space-y-3 text-center sm:text-left flex-1">
                    <div>
                      <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
                        {t("Active Franchise Center")}
                      </span>
                      <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">
                        {center.name}
                      </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-sm">
                      <div>
                        <span className="text-xs text-muted-foreground uppercase font-bold block">{t("Center Code")}:</span>
                        <span className="font-mono font-bold text-foreground">{center.code || "—"}</span>
                      </div>
                      {center.owner_name && (
                        <div>
                          <span className="text-xs text-muted-foreground uppercase font-bold block">{t("Director / Head")}:</span>
                          <span className="font-semibold text-foreground">{center.owner_name}</span>
                        </div>
                      )}
                      {(center.city || center.state) && (
                        <div>
                          <span className="text-xs text-muted-foreground uppercase font-bold block">{t("Location")}:</span>
                          <span className="font-semibold text-foreground">
                            {[center.city, center.state].filter(Boolean).join(", ")}
                          </span>
                        </div>
                      )}
                      {center.phone && (
                        <div>
                          <span className="text-xs text-muted-foreground uppercase font-bold block">{t("Helpline")}:</span>
                          <span className="font-semibold text-foreground">{center.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Address & Public Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                      <MapPin className="w-4 h-4" />
                      {t("Center Address")}
                    </div>
                    <div className="text-sm font-medium text-foreground">
                      {center.address || [center.city, center.state].filter(Boolean).join(", ") || t("Registered Address on File")}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                      <ShieldCheck className="w-4 h-4" />
                      {t("Affiliation Status")}
                    </div>
                    <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      {t("Authorized by Sir Chhotu Ram Education")}
                    </div>
                  </div>
                </div>

                {center.code && (
                  <div className="flex justify-end pt-2 print:hidden">
                    <Link 
                      to={`/centers/${center.code}`}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                    >
                      {t("View Full Center Profile")}
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
