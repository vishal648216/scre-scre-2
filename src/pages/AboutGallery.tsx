import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Gallery3D from "@/components/Gallery3D";
import { Loader2, Sparkles, Camera, Image as ImageIcon } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";

const AboutGallery = () => {
  const { t } = useTranslation();
  const [gallery, setGallery] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGallery = async () => {
      try {
        const res = await apiFetch("/api/cms?category=gallery&active_only=true");
        const data = await res.json();
        if (Array.isArray(data)) {
          const mapped = data.map(item => ({
            src: item.image_url,
            category: item.link || item.category || "General",
            title: item.title || "SCRE Experience",
            description: item.content || "Experience the vibrant campus life and state-of-the-art facilities at Sir Chhotu Ram Education."
          }));
          setGallery(mapped.reverse());
        }
      } catch (err) {
        console.error("Failed to fetch gallery", err);
      } finally {
        setLoading(false);
      }
    };
    fetchGallery();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">Loading 3D Experience...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background selection:bg-primary/20">
      <Header />

      <main className="pt-32 pb-20">
        {/* HERO SECTION */}
        <section className="container mx-auto px-4 mb-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-primary/5 border border-primary/10 mb-8"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">
              {t("Interactive Visual Journey")}
            </span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-black text-foreground uppercase tracking-tighter mb-8"
          >
            {t("Life at")} <span className="bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">SCRE</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-muted-foreground max-w-2xl mx-auto text-lg md:text-xl font-medium leading-relaxed mb-12"
          >
            {t("Explore our campus through an immersive 3D experience. Hover over the cards to interact with the parallax depth effects.")}
          </motion.p>

          <div className="flex flex-wrap justify-center gap-8 text-muted-foreground/60">
            <div className="flex items-center gap-3">
              <Camera className="w-5 h-5" />
              <span className="text-xs font-black uppercase tracking-widest">{gallery.length} {t("High-Res Shots")}</span>
            </div>
            <div className="flex items-center gap-3">
              <ImageIcon className="w-5 h-5" />
              <span className="text-xs font-black uppercase tracking-widest">{t("Immersive Parallax")}</span>
            </div>
          </div>
        </section>

        {/* 3D GALLERY GRID */}
        <section className="container mx-auto px-4">
          <Gallery3D items={gallery} />
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default AboutGallery;
