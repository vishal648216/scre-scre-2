import { useState, useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { usePublicSystemSettings } from "@/hooks/usePublicSystemSettings";
import TopBar from "./TopBar";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  X,
  LogIn,
  LayoutDashboard,
  Clock,
  Phone,
  Mail,
  ChevronDown,
  Download,
  Send,
  Home,
  Info,
  BookOpen,
  Briefcase,
  Users,
  MapPin,
  Image,
  FileText,
  GraduationCap,
  HelpCircle,
  FileSignature,
  Headset,
  Handshake,
  ClipboardList,
  Sparkles,
  UserPlus,
  Globe,
  ShieldCheck,
} from "lucide-react";
import { IoHomeOutline } from "react-icons/io5";
import { PiNotePencilBold } from "react-icons/pi";
import LanguageSwitcher from "./LanguageSwitcher";

import LoginPopup from "./LoginPopup";

declare global {
  interface Window {
    googleTranslateElementInit: () => void;
    google: any;
  }
}

const Header = () => {
  const { t, i18n } = useTranslation();
  const { data: settings } = usePublicSystemSettings();

  const navLinks = [
    { label: t("Home"), href: "/", icon: IoHomeOutline },
    {
      label: t("About"),
      href: "/about",
      icon: Info,
      submenu: [
        { label: t("About Us"), href: "/about", icon: Info },
        { label: t("Our Journey"), href: "/about#journey", icon: Sparkles },
        { label: t("3D Gallery"), href: "/about/gallery", icon: Image },
        { label: t("Director Message"), href: "/about#director", icon: Users },
        { label: t("Our Certifications"), href: "/about#certifications", icon: ShieldCheck },
        { label: t("FAQ"), href: "/faq", icon: HelpCircle },
      ],
    },
    {
      label: t("Courses"),
      href: "/courses",
      icon: BookOpen,
    },
    {
      label: t("Franchise"),
      href: "#",
      icon: Users,
      submenu: [
        { label: t("Franchise Opportunity"), href: "/franchise", icon: Sparkles },
        { label: t("Apply Franchise"), href: "/franchise/apply", icon: FileSignature },
        { label: t("Franchise Login"), href: "/franchise/login", icon: LogIn },
        { label: t("Support System"), href: "/franchise/support", icon: Headset },
        { label: t("Our Partners"), href: "/franchise/partners", icon: Handshake },
        { label: t("Franchise Requirements"), href: "/franchise/requirements", icon: ClipboardList },
        { label: t("Why us"), href: "/franchise/why-us", icon: Sparkles },
        { label: t("Our Centers"), href: "/centers", icon: MapPin },
        { label: t("Center Verification"), href: "/verify/center", icon: ShieldCheck },
      ],
    },
    {
      label: t("Student Zone"),
      href: "#",
      icon: GraduationCap,
      submenu: [
        { label: t("Student Login"), href: "/?login=true", icon: LogIn },
        { label: t("Student Registration"), href: "/admission", icon: UserPlus },
        { label: t("Student Verification"), href: "/verify/student", icon: ShieldCheck },
        { label: t("Certificate Verification"), href: "/certificate-verification", icon: FileText },
        { label: t("Student Internship"), href: "/student-internship", icon: Briefcase },
        { label: t("Student Inquiry"), href: "/student-inquiry", icon: HelpCircle },
      ],
    },
    { label: t("Gallery"), href: "/gallery", icon: Image },
    { label: t("Blog"), href: "/blog", icon: PiNotePencilBold },
  ];
  const [open, setOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);
  const [mobileSubmenu, setMobileSubmenu] = useState(null);
  const [verificationLink, setVerificationLink] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('login') === 'true') {
      setShowLogin(true);
    }
  }, []);
  useEffect(() => {
    const token = sessionStorage.getItem("token");
    setIsLoggedIn(!!token);
  }, []);

  useEffect(() => {
    const fetchVerification = async () => {
      try {
        const res = await apiFetch("/api/cms?category=verification&active_only=true");
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setVerificationLink(data[0].image_url || "");
        }
      } catch (err) {
        // ignore
      }
    };
    fetchVerification();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Fixed state
      setScrolled(currentScrollY > 50);

      // Visible state (hide on scroll down, show on scroll up)
      if (currentScrollY > lastScrollY.current && currentScrollY > 150) {
        setVisible(false);
      } else {
        setVisible(true);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className="relative z-50">
      {/* ================= MARQUEE TOP BAR ================= */}
      <AnimatePresence>
        {!scrolled && (
          <motion.div
            initial={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <TopBar />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= FIXED WRAPPER (DESKTOP & MOBILE) ================= */}
      <div className={`transition-transform duration-500 ease-in-out ${scrolled
        ? `fixed top-0 left-0 w-full z-50 shadow-2xl transform ${visible ? 'translate-y-0' : '-translate-y-full'}`
        : 'relative'
        }`}>
        {/* ================= TOP INFO BAR - NOW ABOVE BRANDING AND HIDDEN ON SCROLL ================= */}
        <AnimatePresence>
          {!scrolled && (
            <motion.div
              initial={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="border-b border-border/60 bg-background py-2">
                <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-2 px-4 text-[11px]">
                  <div className="flex items-center gap-2 md:gap-4">
                    <Clock className="h-3 w-3" />
                    <span>{t("Mon - Fri: 10.00 am - 06.00 pm")}</span>

                    <div className="flex items-center gap-1.5 ml-2 group">
                      {/* <Globe className="h-3 w-3 text-primary transition-all" /> */}
                      <LanguageSwitcher />
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-center md:justify-end items-center gap-2 md:gap-4">
                    <Phone className="h-3 w-3" />
                    <a href={`tel:${(settings?.contact_phone as string) || "+919466317100"}`} className="font-semibold hover:underline">
                      {(settings?.contact_phone as string) || "+91 9466317100"}
                    </a>

                    <a
                      href={`mailto:${(settings?.contact_email as string) || "info@screduc.com"}`}
                      className="flex items-center gap-1 hover:text-accent transition-colors"
                    >
                      <Mail className="w-3 h-3" />
                      <span>{(settings?.contact_email as string) || "info@screduc.com"}</span>
                    </a>

                    <a
                      href={verificationLink || "/verification-letter"}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-primary px-4 py-1.5 text-[11px] font-black uppercase tracking-widest text-primary-foreground shadow-sm hover:bg-primary-dark transition flex items-center gap-2"
                    >
                      <ShieldCheck className="w-3 h-3" />
                      {t("Verification Letter")}
                    </a>

                    <a
                      href="/#contact"
                      className="rounded-full bg-accent px-4 py-1.5 text-[11px] font-black uppercase tracking-widest text-accent-foreground shadow-sm hover:bg-accent-dark transition flex items-center gap-2"
                    >
                      <Send className="w-3 h-3" />
                      {t("Enquiry Now")}
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ================= BRANDING (DESKTOP) - NOW BELOW TOP INFO BAR ================= */}
        <AnimatePresence>
          {!scrolled && (
            <motion.div
              initial={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="hidden lg:block bg-card border-b border-border overflow-hidden"
            >
              <div className="container mx-auto grid grid-cols-[140px_1fr_140px] items-center px-16 py-8 transition-all duration-500 gap-12">
                {/* Logo */}
                <div className="flex justify-center">
                  <div className="p-1 rounded-2xl bg-gradient-to-br from-accent/20 to-transparent flex-shrink-0 group/logo">
                    <img
                      src="/images/logo.jpeg"
                      alt="SCRE Logo"
                      className="h-28 w-28 rounded-xl border-2 border-accent/40 object-cover shadow-md transition-all duration-500 group-hover/logo:scale-110 group-hover/logo:shadow-[0_30px_60px_-12px_rgba(0,74,137,0.4)] group-hover/logo:border-accent"
                    />
                  </div>
                </div>

                {/* Middle: Name + Details */}
                <div className="flex flex-col items-center text-center w-full overflow-hidden">
                  <h1 className="font-heading text-xl md:text-3xl lg:text-2xl font-black text-[#004a89] uppercase tracking-tight whitespace-nowrap">
                    {t("Sir Chhotu Ram Education Pvt. Ltd.")}
                  </h1>

                  <p className="text-[11px] text-muted-foreground font-medium mt-1">
                    {t("An ISO 9001-2015 Certified Organization")}
                  </p>

                  <p className="text-[11px] text-muted-foreground font-medium">
                    {t("Registered Under The Company ACT 2013 By The Ministry Of Corporate Affairs")}
                  </p>

                  <p className="text-[11px] text-muted-foreground font-medium">
                    {t("Ministry of Micro, Small & Medium Enterprises,")}
                  </p>

                  <p className="text-xl font-black text-foreground/80 mt-1">
                    {t("Government of India")}
                  </p>
                </div>

                {/* Right: ISO Logo */}
                <div className="flex justify-center">
                  <div className="p-1 rounded-2xl bg-gradient-to-br from-accent/20 to-transparent flex-shrink-0 group/iso">
                    <img
                      src="/images/iso.webp"
                      alt={t("ISO Certified")}
                      className="h-28 w-28 rounded-xl border-2 border-accent/40 object-cover shadow-md transition-all duration-500 group-hover/iso:scale-110 group-hover/iso:shadow-[0_30px_60px_-12px_rgba(0,74,137,0.4)] group-hover/iso:border-accent"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ================= MOBILE BRAND + TOGGLER (MOBILE ONLY - FIXED WHEN SCROLLED) ================= */}
        <div className={`lg:hidden border-b border-border transition-all duration-300 ${scrolled ? 'bg-card/95 backdrop-blur-md py-2' : 'bg-card py-3'
          }`}>
          <div className="container mx-auto flex items-center justify-between px-4">
            {/* Left: Logo + Name */}
            <a href="/" className="flex items-center gap-3">
              <img
                src="/images/logo.jpeg"
                alt="SCRE Logo"
                className={`${scrolled ? 'h-8 w-8' : 'h-10 w-10'} rounded-md border-2 border-accent/40 object-cover transition-all`}
              />
              <div className="flex flex-col leading-tight">
                <span className={`${scrolled ? 'text-xs' : 'text-sm'} font-heading font-black text-[#004a89] uppercase tracking-tight transition-all`}>
                  {t("Sir Chhotu Ram Education")}
                </span>
                {!scrolled && (
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">
                    {t("IT & Skill Education")}
                  </span>
                )}
              </div>
            </a>

            {/* Right: Toggler */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOpen(!open)}
                className="p-2 text-foreground"
              >
                {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* ================= NAVIGATION (DESKTOP) ================= */}
        <div
          className={`hidden lg:block border-t border-border transition-all duration-300 ${scrolled
            ? "bg-card/95 backdrop-blur-md shadow-lg"
            : "bg-card"
            }`}
        >
          <div className="container mx-auto flex items-center justify-center py-2 px-2">
            <nav className="flex flex-wrap justify-center items-center gap-1 xl:gap-2">
              {navLinks.map((link, index) => (
                <div key={index} className="relative group">
                  {link.submenu ? (
                    <>
                      <button className="flex items-center gap-1 xl:gap-2 px-2 xl:px-3 py-2 text-sm font-semibold text-foreground hover:text-primary transition rounded-lg hover:bg-primary-light">
                        {link.icon && <link.icon className="w-3.5 h-3.5 xl:w-4 xl:h-4 stroke-[2.5px]" />}
                        {t(link.label)}

                        <ChevronDown className="w-3.5 h-3.5 xl:w-4 xl:h-4 transition-transform duration-300 group-hover:rotate-180" />
                      </button>

                      <div className="absolute left-0 top-full mt-2 w-56 bg-card border border-border rounded-xl shadow-xl opacity-0 invisible translate-y-3 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-300 z-50">
                        {link.submenu.map((item, i) => (
                          <a
                            key={i}
                            href={item.href}
                            onClick={(e) => {
                              if (item.href === "/?login=true") {
                                e.preventDefault();
                                setShowLogin(true);
                              }
                            }}
                            className="flex items-center gap-2 px-5 py-3 text-sm font-medium text-foreground hover:bg-primary/10 transition"
                          >
                            {item.icon && <item.icon className="w-4 h-4 text-muted-foreground stroke-[2.5px]" />}
                            {t(item.label)}
                          </a>
                        ))}
                      </div>
                    </>
                  ) : (
                    <a
                      href={link.href}
                      className="flex items-center gap-1 xl:gap-2 px-2 xl:px-3 py-2 text-sm font-semibold text-foreground hover:text-primary transition rounded-lg hover:bg-primary-light"
                    >
                      {link.icon && <link.icon className="w-3.5 h-3.5 xl:w-4 xl:h-4 stroke-[2.5px]" />}
                      {t(link.label)}
                    </a>
                  )}
                </div>
              ))}

              <a
                href="/downloads"
                className="ml-1 flex items-center gap-1 xl:gap-2 rounded-lg bg-secondary px-3 xl:px-5 py-2 text-sm font-heading font-bold text-secondary-foreground shadow-md hover:bg-secondary-dark transition"
              >
                <Download className="w-3.5 h-3.5 xl:w-4 xl:h-4" />
                {t("Downloads")}
              </a>

              <a
                href="/shop"
                className="ml-1 flex items-center gap-1 xl:gap-2 rounded-lg bg-accent px-3 xl:px-5 py-2 text-sm font-heading font-bold text-accent-foreground shadow-md hover:bg-accent-dark transition"
              >
                <Briefcase className="w-3.5 h-3.5 xl:w-4 xl:h-4" />
                {t("Shop")}
              </a>

              <button
                onClick={() => {
                  if (isLoggedIn) {
                    window.location.href = "/dashboard";
                  } else {
                    setShowLogin(true);
                  }
                }}
                className="ml-1 flex items-center gap-1 xl:gap-2 rounded-lg bg-primary px-3 xl:px-5 py-2 text-sm font-heading font-bold text-primary-foreground shadow-md hover:bg-primary-dark transition"
              >
                <LogIn className="h-3.5 w-3.5 xl:h-4 xl:w-4" /> {t("login")}
              </button>
            </nav>
          </div>
        </div>

        {/* ================= MOBILE NAV - NOW INSIDE WRAPPER ================= */}
        <AnimatePresence>
          {open && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="lg:hidden bg-card border-t border-border px-4 pb-4 overflow-hidden"
            >
              {navLinks.map((link, index) => (
                <div key={index}>
                  {link.submenu ? (
                    <>
                      <button
                        onClick={() =>
                          setMobileSubmenu(
                            mobileSubmenu === link.label ? null : link.label
                          )
                        }
                        className="w-full flex items-center justify-between py-3 text-sm font-semibold text-foreground border-b border-border/50"
                      >
                        <span className="flex items-center gap-2">
                          {link.icon && <link.icon className="w-4 h-4 stroke-[2.5px]" />}
                          {t(link.label)}
                        </span>

                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${mobileSubmenu === link.label ? "rotate-180" : ""
                            }`}
                        />
                      </button>

                      {mobileSubmenu === link.label && (
                        <div className="pl-6 pb-2 space-y-1">
                          {link.submenu.map((item, i) => (
                            <a
                              key={i}
                              href={item.href}
                              onClick={(e) => {
                                setOpen(false);
                                if (item.href === "/?login=true") {
                                  e.preventDefault();
                                  setShowLogin(true);
                                }
                              }}
                              className="flex items-center gap-2 py-2 text-sm text-muted-foreground hover:text-primary"
                            >
                              {item.icon && <item.icon className="w-4 h-4 stroke-[2.5px]" />}
                              {t(item.label)}
                            </a>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <a
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 py-3 text-sm font-semibold text-foreground hover:text-primary border-b border-border/50"
                    >
                      {link.icon && <link.icon className="w-4 h-4 stroke-[2.5px]" />}
                      {t(link.label)}
                    </a>
                  )}
                </div>
              ))}

              <div className="mt-4 flex flex-col gap-3">

                <a
                  href="/downloads"
                  className="flex items-center justify-center gap-2 bg-secondary text-secondary-foreground px-5 py-3 rounded-lg font-heading font-bold text-sm"
                >
                  <Download className="w-4 h-4" />
                  {t("Downloads")}
                </a>

                <a
                  href="/shop"
                  className="flex items-center justify-center gap-2 bg-accent text-accent-foreground px-5 py-3 rounded-lg font-heading font-bold text-sm"
                >
                  <Briefcase className="w-4 h-4" />
                  {t("Shop")}
                </a>

                <button
                  onClick={() => {
                    setOpen(false);
                    setShowLogin(true);
                  }}
                  className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-5 py-3 rounded-lg font-heading font-bold text-sm"
                >
                  <LogIn className="w-4 h-4" />
                  {t("login")}
                </button>

                <a
                  href={verificationLink || "/verification-letter"}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-5 py-3 rounded-lg font-heading font-bold text-sm"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {t("Verification Letter")}
                </a>

                <a
                  href="#contact"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center gap-2 bg-accent text-accent-foreground px-5 py-3 rounded-lg font-heading font-bold text-sm"
                >
                  <Send className="w-4 h-4" />
                  {t("Enquiry Now")}
                </a>

              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>

      <LoginPopup isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </header>
  );
};

export default Header;
