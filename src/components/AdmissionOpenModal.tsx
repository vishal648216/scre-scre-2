import { useEffect, useState } from "react";
import { X, GraduationCap, Calendar, ArrowRight, Sparkles, Gift, Loader2 } from "lucide-react";
import { usePublicSystemSettings } from "@/hooks/usePublicSystemSettings";

interface SystemSettings {
  popup_enabled: boolean;
  popup_title: string;
  popup_subtitle: string;
  popup_accent_text: string;
  popup_image_url: string;
  popup_bg_color: string;
  popup_text_color: string;
  popup_button_text: string;
  popup_button_link: string;
}

// Module-level flag: persists across SPA navigations, resets on full reload.
let hasShownThisPageLoad = false;

const AdmissionOpenModal = () => {
  const [show, setShow] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const { data: raw, isLoading } = usePublicSystemSettings();
  const settings = raw as SystemSettings | null | undefined;

  useEffect(() => {
    // Show only once per full page load (first visit / browser reload)
    if (!hasShownThisPageLoad && settings?.popup_enabled) {
      hasShownThisPageLoad = true;
      // Delay to make it feel less intrusive
      const timer = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [settings]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: (e.clientX - rect.left) / rect.width - 0.5,
      y: (e.clientY - rect.top) / rect.height - 0.5
    });
  };

  if (!show || !settings?.popup_enabled) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
      onClick={() => setShow(false)}
    >
      <div 
        className="relative w-full max-w-4xl bg-gradient-to-br rounded-[40px] shadow-[0_0_50px_rgba(0,0,0,0.3)] overflow-hidden border border-white/10 animate-in zoom-in-95 duration-500 flex flex-col md:flex-row"
        style={{ 
          backgroundColor: settings.popup_bg_color || "#004a89",
          color: settings.popup_text_color || "#ffffff"
        }}
        onMouseMove={handleMouseMove}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Canvas-style Floating Assists */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div 
            className="absolute top-10 left-10 w-24 h-24 border-2 border-white/10 rounded-full transition-transform duration-300 ease-out"
            style={{ transform: `translate(${mousePos.x * 20}px, ${mousePos.y * 20}px)` }}
          />
          <div 
            className="absolute bottom-20 right-20 w-32 h-32 border-2 border-white/10 rounded-[40px] rotate-45 transition-transform duration-500 ease-out"
            style={{ transform: `translate(${mousePos.x * -30}px, ${mousePos.y * -30}px) rotate(45deg)` }}
          />
          <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/[0.03] rounded-full blur-3xl transition-transform duration-700 ease-out"
            style={{ transform: `translate(${mousePos.x * 50}px, ${mousePos.y * 50}px) translate(-50%, -50%)` }}
          />
          {/* Animated Particles */}
          <div className="absolute inset-0 opacity-20">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-white rounded-full animate-ping"
                style={{
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${i * 0.5}s`,
                  animationDuration: `${3 + Math.random() * 2}s`
                }}
              />
            ))}
          </div>
        </div>
        
        {/* Close Button */}
        <button
          onClick={() => setShow(false)}
          className="absolute top-6 right-6 p-2 rounded-full bg-black/10 hover:bg-black/20 text-white/80 hover:text-white transition-all z-20 border border-white/10 shadow-lg"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left: Image Section (Horizontal focus) */}
        <div className="w-full md:w-1/2 relative min-h-[300px] md:min-h-full overflow-hidden">
          {settings.popup_image_url ? (
            <img 
              src={settings.popup_image_url} 
              alt="Promotion" 
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-accent/20 flex items-center justify-center">
              <GraduationCap className="w-24 h-24 text-accent/40" />
            </div>
          )}
          {/* Overlay gradient for text readability on mobile */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent md:hidden" />
        </div>

        {/* Right: Content Section */}
        <div className="w-full md:w-1/2 p-8 sm:p-12 flex flex-col justify-center relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/10 text-accent text-[10px] font-black uppercase tracking-[0.3em] mb-6 w-fit">
            <Sparkles className="w-3 h-3" />
            Limited Time Offer
          </div>

          {/* Main Title */}
          <div className="space-y-2 mb-8">
            <h2 className="text-4xl sm:text-5xl font-black uppercase tracking-tighter leading-none text-white">
              {settings.popup_title || "Admission Open"}
            </h2>
            <p className="text-2xl font-bold opacity-90 tracking-tight text-accent">
              {settings.popup_subtitle || "2026 - 2027"}
            </p>
          </div>

          {/* Details Box */}
          <div className="bg-white/5 backdrop-blur-sm rounded-[32px] p-6 mb-10 border border-white/10 relative group hover:bg-white/10 transition-all duration-500">
            <div className="flex items-center gap-4 mb-2 text-accent">
              <Calendar className="w-6 h-6" />
              <span className="text-xl font-black uppercase tracking-widest italic">New Batch</span>
            </div>
            <p className="text-lg font-medium leading-tight text-white">
              Starting from <br />
              <span className="text-2xl font-black uppercase tracking-wider">
                {settings.popup_accent_text || "April 2026"}
              </span>
            </p>
            <div className="absolute -top-3 -right-3 w-12 h-12 bg-accent text-accent-foreground rounded-2xl flex items-center justify-center rotate-12 shadow-xl group-hover:scale-110 transition-transform">
              <Gift className="w-6 h-6" />
            </div>
          </div>

          {/* CTA Button */}
          <a
            href={settings.popup_button_link || "#contact"}
            onClick={() => setShow(false)}
            className="group relative flex items-center justify-center gap-3 bg-accent text-accent-foreground px-8 py-5 rounded-2xl font-heading font-black text-sm uppercase tracking-[0.2em] shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
          >
            {settings.popup_button_text || "Apply Now"}
            <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
          </a>
          
          <button
            onClick={() => setShow(false)}
            className="mt-6 text-white/40 text-[10px] font-black uppercase tracking-widest hover:text-white/80 transition-colors text-center"
          >
            Not interested? Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdmissionOpenModal;
