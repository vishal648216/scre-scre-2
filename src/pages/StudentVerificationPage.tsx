import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  ShieldCheck, 
  Search, 
  User, 
  GraduationCap, 
  Building2, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Printer,
  QrCode
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { normalizeAssetUrl } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export default function StudentVerificationPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [dob, setDob] = useState("");
  const [loading, setLoading] = useState(false);
  const [student, setStudent] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    setLoading(true);
    setError(null);
    setStudent(null);

    try {
      const params = new URLSearchParams();
      params.set("query", cleanQuery);
      if (dob) params.set("dob", dob);

      const res = await apiFetch(`/api/public/verify-student?${params.toString()}`);
      const data = await res.json();

      if (res.ok && data.success && data.student) {
        setStudent(data.student);
      } else {
        setError(data.message || t("No student record found matching the provided details."));
      }
    } catch {
      setError(t("Verification service currently unavailable. Please try again later."));
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
              {t("Official Verification Portal")}
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
              {t("Student")} <span className="text-primary">{t("Verification")}</span>
            </h1>
            <p className="text-muted-foreground text-sm max-w-xl mx-auto">
              {t("Verify student enrollment status, course affiliation, and academic credentials registered with Sir Chhotu Ram Education.")}
            </p>
          </div>

          {/* Search Card */}
          <Card className="rounded-3xl border border-border shadow-lg bg-card/90 backdrop-blur-md overflow-hidden">
            <CardHeader className="bg-primary/5 border-b border-border/60 pb-5">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Search className="w-5 h-5 text-primary" />
                {t("Enter Verification Details")}
              </CardTitle>
              <CardDescription>
                {t("Enter Enrollment Number, Roll Number, or Student Username")}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {t("Enrollment No. / Roll No. / Username")} *
                    </label>
                    <div className="relative">
                      <Input
                        type="text"
                        placeholder="e.g. SCRE/2026/001 or ROLL1024"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="rounded-2xl h-12 text-sm pl-4 pr-10 uppercase font-semibold"
                        required
                      />
                      <QrCode className="w-5 h-5 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {t("Date of Birth (Optional)")}
                    </label>
                    <Input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="rounded-2xl h-12 text-sm"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button 
                    type="submit" 
                    disabled={loading || !query.trim()} 
                    className="rounded-2xl h-12 px-8 font-bold text-xs uppercase tracking-widest gap-2 shadow-md hover:shadow-lg transition-all"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    {t("Verify Student")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Results Area */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground font-medium">{t("Searching academic records...")}</p>
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

          {!loading && student && (
            <Card className="rounded-3xl border border-emerald-500/30 bg-card shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
              {/* Verified Badge Banner */}
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-base tracking-wide uppercase">
                      {t("Officially Verified Student")}
                    </h2>
                    <p className="text-xs text-emerald-100 font-medium">
                      {t("Record authentic & active in institute database")}
                    </p>
                  </div>
                </div>
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

              <CardContent className="p-6 sm:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start border-b border-border pb-6">
                  {/* Photo */}
                  <div className="w-32 h-36 rounded-2xl overflow-hidden border-2 border-border bg-muted flex items-center justify-center shadow-sm shrink-0">
                    {student.photo_url ? (
                      <img 
                        src={normalizeAssetUrl(student.photo_url)} 
                        alt={student.full_name} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = "/images/icc-2.jpg";
                        }}
                      />
                    ) : (
                      <User className="w-14 h-14 text-muted-foreground" />
                    )}
                  </div>

                  {/* Core Details */}
                  <div className="space-y-3 text-center sm:text-left flex-1">
                    <div>
                      <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
                        {student.status || "Active Student"}
                      </span>
                      <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">
                        {student.full_name}
                      </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-sm">
                      <div>
                        <span className="text-xs text-muted-foreground uppercase font-bold block">{t("Enrollment No")}:</span>
                        <span className="font-mono font-bold text-foreground">{student.enrollment_number || "—"}</span>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground uppercase font-bold block">{t("Roll No")}:</span>
                        <span className="font-mono font-bold text-foreground">{student.roll_number || "—"}</span>
                      </div>
                      {student.father_name && (
                        <div>
                          <span className="text-xs text-muted-foreground uppercase font-bold block">{t("Father's Name")}:</span>
                          <span className="font-semibold text-foreground">{student.father_name}</span>
                        </div>
                      )}
                      {student.dob && (
                        <div>
                          <span className="text-xs text-muted-foreground uppercase font-bold block">{t("Date of Birth")}:</span>
                          <span className="font-semibold text-foreground">{student.dob}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Academic & Center Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                      <GraduationCap className="w-4 h-4" />
                      {t("Enrolled Course")}
                    </div>
                    <div className="text-base font-bold text-foreground">
                      {student.course || t("General Education")}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                      <Building2 className="w-4 h-4" />
                      {t("Study Center")}
                    </div>
                    <div className="text-base font-bold text-foreground">
                      {student.center_name || t("Sir Chhotu Ram Education Head Office")}
                    </div>
                  </div>
                </div>

                <div className="text-center pt-2 text-xs text-muted-foreground">
                  {t("This verification record is electronically authenticated by Sir Chhotu Ram Education Pvt. Ltd.")}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
