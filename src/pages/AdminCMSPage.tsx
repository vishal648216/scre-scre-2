import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  Image as ImageIcon,
  BookOpen,
  UserPlus,
  Users,
  Handshake,
  Download,
  Layers,
  HelpCircle,
  ShieldCheck,
  ShoppingBag,
  List,
  GraduationCap,
  Newspaper,
  FilePenLine
} from "lucide-react";
import CMSManager, { CMSType } from "@/components/cms/CMSManager";
import GalleryManager from "@/components/cms/GalleryManager";
import DownloadCategoryManager from "@/components/cms/DownloadCategoryManager";
import { useTranslation } from "react-i18next";

const CMS_TABS = ["pages", "slider", "gallery", "teachers", "partners", "downloads", "download_categories", "verification", "ticker", "faq", "idcard_templates", "shop", "director_message", "students", "universities", "hero_partners"] as const;
type Tab = typeof CMS_TABS[number] | "blogs" | "news";

const AdminCMSPage = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const segs = location.pathname.split("/").filter(Boolean);
  const last = segs[segs.length - 1] as string;
  const tabFromPath: Tab = ["blogs", "news"].includes(last) ? (last as Tab) : (CMS_TABS as readonly string[]).includes(last) ? (last as Tab) : "pages";
  const [activeTab, setActiveTab] = useState<Tab>(tabFromPath);

  useEffect(() => {
    setActiveTab(tabFromPath);
  }, [tabFromPath]);

  const onTabChange = (v: string) => {
    if (v === "blogs") {
      navigate("/dashboard/cms/blogs");
    } else if (v === "news") {
      navigate("/dashboard/cms/news");
    } else {
      setActiveTab(v as Tab);
      navigate(`/dashboard/cms/${v}`);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black text-foreground uppercase tracking-tight">
            {t("CMS Management")}
          </h1>
          <p className="text-muted-foreground font-medium">
            {t("Control all dynamic content across the SCRE platform.")}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
          <TabsList className="rounded-none flex flex-wrap gap-1 h-auto overflow-x-auto justify-start">
            <TabsTrigger value="pages" className="rounded-none flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {t("Pages")}
            </TabsTrigger>
            <TabsTrigger value="blogs" className="rounded-none flex items-center gap-2">
              <FilePenLine className="w-4 h-4" />
              {t("Blogs")}
            </TabsTrigger>
            <TabsTrigger value="news" className="rounded-none flex items-center gap-2">
              <Newspaper className="w-4 h-4" />
              {t("News")}
            </TabsTrigger>
            <TabsTrigger value="slider" className="rounded-none flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              {t("Hero Slider")}
            </TabsTrigger>
            <TabsTrigger value="gallery" className="rounded-none flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              {t("Gallery")}
            </TabsTrigger>
            <TabsTrigger value="teachers" className="rounded-none flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              {t("Teachers")}
            </TabsTrigger>
            <TabsTrigger value="partners" className="rounded-none flex items-center gap-2">
              <Users className="w-4 h-4" />
              {t("Partners")}
            </TabsTrigger>
            <TabsTrigger value="downloads" className="rounded-none flex items-center gap-2">
              <Download className="w-4 h-4" />
              {t("Downloads")}
            </TabsTrigger>
            <TabsTrigger value="download_categories" className="rounded-none flex items-center gap-2">
              <List className="w-4 h-4" />
              {t("Download Categories")}
            </TabsTrigger>
            <TabsTrigger value="verification" className="rounded-none flex items-center gap-2">
              {t("Verification")}
            </TabsTrigger>
            <TabsTrigger value="ticker" className="rounded-none flex items-center gap-2">
              <Layers className="w-4 h-4" />
              {t("Ticker")}
            </TabsTrigger>
            <TabsTrigger value="faq" className="rounded-none flex items-center gap-2">
              <HelpCircle className="w-4 h-4" />
              {t("FAQ")}
            </TabsTrigger>
            <TabsTrigger value="idcard_templates" className="rounded-none flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              {t("ID Card Templates")}
            </TabsTrigger>
            <TabsTrigger value="shop" className="rounded-none flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              {t("Shop")}
            </TabsTrigger>
            <TabsTrigger value="director_message" className="rounded-none flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              {t("Director Message")}
            </TabsTrigger>
            <TabsTrigger value="students" className="rounded-none flex items-center gap-2">
              <Users className="w-4 h-4" />
              {t("Students")}
            </TabsTrigger>
            <TabsTrigger value="universities" className="rounded-none flex items-center gap-2">
              <GraduationCap className="w-4 h-4" />
              {t("Universities")}
            </TabsTrigger>
            <TabsTrigger value="hero_partners" className="rounded-none flex items-center gap-2">
              <Handshake className="w-4 h-4" />
              {t("Hero Partners")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="download_categories" className="mt-6">
            <DownloadCategoryManager />
          </TabsContent>

          <TabsContent value="shop" className="mt-6">
            <CMSManager
              category="shop"
              title={t("Shop management")}
            />
          </TabsContent>

          {/* Blogs and News tabs are separate pages, no TabsContent needed */}
          
          {CMS_TABS.map((tab) => {
            if (tab === "download_categories" || tab === "shop") return null;

            let category: CMSType = "page";
            if (tab === "slider") category = "slider";
            else if (tab === "gallery") category = "gallery";
            else if (tab === "teachers") category = "teacher";
            else if (tab === "partners") category = "partner";
            else if (tab === "downloads") category = "download";
            else if (tab === "ticker") category = "ticker";
            else if (tab === "verification") category = "verification";
            else if (tab === "faq") category = "faq";
            else if (tab === "idcard_templates") category = "idcard_template";
            else if (tab === "director_message") category = "directormessage";
            else if (tab === "students") category = "student";
            else if (tab === "universities") category = "university";
            else if (tab === "hero_partners") category = "heropartners";

            return (
              <TabsContent key={tab} value={tab} className="mt-6">
                {tab === "gallery" ? (
                  <GalleryManager />
                ) : (
                  <CMSManager
                    category={category}
                    title={t(`${tab} management`)}
                  />
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AdminCMSPage;
