import React, { useState, useRef, useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";

interface GalleryItem {
  src: string;
  title?: string;
  description?: string;
  category?: string;
}

interface Gallery3DProps {
  items: GalleryItem[];
}

const Gallery3DCard = ({ item, index, onClick }: { item: GalleryItem; index: number; onClick: () => void }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Motion values for tilt
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Smooth springs for rotation
  const rotateX = useSpring(useTransform(y, [-100, 100], [15, -15]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(x, [-100, 100], [-15, 15]), { stiffness: 300, damping: 30 });

  // Shine effect position
  const shineX = useTransform(x, [-100, 100], ["0%", "100%"]);
  const shineY = useTransform(y, [-100, 100], ["0%", "100%"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Calculate relative position from -100 to 100
    const relativeX = ((mouseX / width) - 0.5) * 200;
    const relativeY = ((mouseY / height) - 0.5) * 200;
    
    x.set(relativeX);
    y.set(relativeY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
        perspective: 1000,
      }}
      className="relative group cursor-pointer w-full aspect-[4/5] rounded-[2rem] overflow-hidden bg-card border border-border/50 shadow-2xl transition-shadow hover:shadow-primary/20"
    >
      {/* GLOW LAYER (Back) */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-3xl pointer-events-none"
        style={{
          background: "radial-gradient(circle at center, var(--primary) 0%, transparent 70%)",
          transform: "translateZ(-50px) scale(0.8)",
        }}
      />

      {/* IMAGE LAYER */}
      <div className="absolute inset-0 overflow-hidden rounded-[1.8rem]">
        <motion.img
          src={item.src}
          alt={item.title}
          className="w-full h-full object-fill transition-transform duration-700 group-hover:scale-110"
          style={{ transform: "translateZ(20px)" }}
        />
        {/* SHINE OVERLAY */}
        <motion.div 
          className="absolute inset-0 z-10 opacity-0 group-hover:opacity-30 pointer-events-none transition-opacity duration-500"
          style={{
            background: "linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.8) 50%, transparent 100%)",
            backgroundSize: "200% 200%",
            x: shineX,
            y: shineY,
          }}
        />
      </div>

      {/* CONTENT LAYER (Front) */}
      <div 
        className="absolute inset-0 flex flex-col justify-end p-8 z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-500"
        style={{ transform: "translateZ(60px)" }}
      >
        <div className="bg-black/80 p-6 rounded-3xl border border-white/10 translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary mb-3 block">
            {item.category || "Gallery Item"}
          </span>
          <h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-none mb-3">
            {item.title}
          </h3>
          <p className="text-xs font-medium text-white/60 line-clamp-2 leading-relaxed">
            {item.description || "Experience the vibrant campus life and state-of-the-art facilities at Sir Chhotu Ram Education."}
          </p>
        </div>
      </div>

      {/* DECORATIVE BORDER */}
      <div className="absolute inset-0 rounded-[2rem] border-2 border-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-30" />
    </motion.div>
  );
};

const Gallery3D = ({ items }: Gallery3DProps) => {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedIdx === null) return;
      if (e.key === "Escape") setSelectedIdx(null);
      if (e.key === "ArrowRight") setSelectedIdx((selectedIdx + 1) % items.length);
      if (e.key === "ArrowLeft") setSelectedIdx((selectedIdx - 1 + items.length) % items.length);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIdx, items.length]);

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {items.map((item, idx) => (
          <Gallery3DCard 
            key={idx} 
            item={item} 
            index={idx} 
            onClick={() => setSelectedIdx(idx)} 
          />
        ))}
      </div>

      {/* LIGHTBOX MODAL */}
      <AnimatePresence>
        {selectedIdx !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-4 md:p-10"
          >
            <motion.button
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              onClick={() => setSelectedIdx(null)}
              className="absolute top-6 right-6 z-[110] p-4 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-all"
            >
              <X className="w-6 h-6" />
            </motion.button>

            <div className="relative w-full h-full flex items-center justify-center">
              <motion.button
                whileHover={{ scale: 1.1, x: -5 }}
                onClick={(e) => { e.stopPropagation(); setSelectedIdx((selectedIdx - 1 + items.length) % items.length); }}
                className="absolute left-0 z-[110] p-4 text-white/40 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-12 h-12" />
              </motion.button>

              <motion.div
                key={selectedIdx}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="relative max-w-5xl w-full h-full flex flex-col items-center justify-center"
              >
                <img
                  src={items[selectedIdx].src}
                  alt={items[selectedIdx].title}
                  className="max-w-full max-h-[70vh] object-contain rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10"
                />
                <div className="mt-8 text-center max-w-2xl">
                  <span className="text-primary text-[10px] font-black uppercase tracking-[0.4em] mb-3 block">
                    {items[selectedIdx].category || "Gallery Item"}
                  </span>
                  <h2 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter mb-4">
                    {items[selectedIdx].title}
                  </h2>
                  <p className="text-white/60 text-sm md:text-lg font-medium leading-relaxed">
                    {items[selectedIdx].description}
                  </p>
                </div>
              </motion.div>

              <motion.button
                whileHover={{ scale: 1.1, x: 5 }}
                onClick={(e) => { e.stopPropagation(); setSelectedIdx((selectedIdx + 1) % items.length); }}
                className="absolute right-0 z-[110] p-4 text-white/40 hover:text-white transition-colors"
              >
                <ChevronRight className="w-12 h-12" />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Gallery3D;
