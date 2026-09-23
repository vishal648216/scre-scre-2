import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import { useTranslation } from "react-i18next";

const StudentZonePage = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <section className="bg-muted/30 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <h1 className="font-heading font-extrabold text-4xl text-foreground tracking-tight">{t("Student Zone")}</h1>
          <p className="text-muted-foreground mt-2 text-sm font-medium">
            {t("Access attendance, certificates, announcements, and typing practice.")}
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="rounded-none border-border">
          <CardHeader>
            <CardTitle className="text-base font-black tracking-tight">{t("Login")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="text-muted-foreground">{t("Use your student account to access your dashboard.")}</p>
            <Link to="/" className="inline-block mt-3 px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-primary text-primary-foreground">
              {t("Go to Login")}
            </Link>
          </CardContent>
        </Card>
        <Card className="rounded-none border-border">
          <CardHeader>
            <CardTitle className="text-base font-black tracking-tight">{t("Certificates")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="text-muted-foreground">{t("View and download your issued certificates.")}</p>
          </CardContent>
        </Card>
        <Card className="rounded-none border-border">
          <CardHeader>
            <CardTitle className="text-base font-black tracking-tight">{t("Typing Practice")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="text-muted-foreground">{t("Practice your typing and track progress.")}</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default StudentZonePage;
