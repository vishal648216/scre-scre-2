import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';

const MaintenancePage = () => {
  const [clickCount, setClickCount] = useState(0);
  const [showLogin, setShowLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [progress, setProgress] = useState(42.0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [codeLines, setCodeLines] = useState<string[]>([]);

  // Matrix Rain Effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$+-*/=%&@#";
    const fontSize = 14;
    const columns = canvas.width / fontSize;
    const drops: number[] = Array(Math.floor(columns)).fill(1);

    const draw = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#0f0";
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = characters.charAt(Math.floor(Math.random() * characters.length));
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    const interval = setInterval(draw, 50);
    return () => clearInterval(interval);
  }, []);

  // Progress Simulation (Persistent logic based on current time)
  useEffect(() => {
    const START_TIME = 1775539500000; // Fixed start time
    const BASE_PROGRESS = 42.0;

    const timer = setInterval(() => {
      const now = Date.now();
      const elapsedMinutes = (now - START_TIME) / (60 * 1000);
      let calculated = BASE_PROGRESS + (elapsedMinutes * 0.066667); // 1% per 15 mins approx
      calculated += Math.sin(now / 1000) * 0.0005; // Jitter
      if (calculated > 99.98) calculated = 99.98;
      setProgress(calculated);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Random Code Runner
  useEffect(() => {
    const snippets = [
      "CONNECT 192.168.1.1:8080 ... [SUCCESS]",
      "PUSH update_v2.4.1 --force-origin --global-cdn",
      "RE-INDEXING DATABASE MONGODB_SCRC_PROD ... [IN_PROGRESS]",
      "SSL CERTIFICATE RENEWAL VALIDATED [SHA-256]",
      "TRANSFERRING PACKET: 0x8F23A1D --TARGET: EDGE_NODE_SINGAPORE",
      "SYNCING ORIGIN: SERVER-SCRC-MAIN -> CLOUDFLARE_CDN_V4",
      "DECRYPTING CORE_SYSTEM_CONFIG.YAML ... [OK]",
      "UPDATING KERNEL MODULES: NET_V2.1.0",
      "LATENCY OPTIMIZATION: 14ms -> 8ms",
      "DIVERGING ORIGIN TRAFFIC TO MAINTENANCE_PAGE_V2"
    ];

    const timer = setInterval(() => {
      setCodeLines(prev => {
        const next = [...prev, `> ${snippets[Math.floor(Math.random() * snippets.length)]}`];
        return next.slice(-6);
      });
    }, 2000);

    return () => clearInterval(timer);
  }, []);

  const handleGlobalClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);
    if (newCount === 3) {
      setShowLogin(true);
      setClickCount(0);
    }
  };

  const handleBypass = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Quick frontend check for the requested master bypass key
    if (password === 'Aditya@99918') {
      localStorage.setItem('maintenance_bypass', 'true');
      toast.success('Bypass authenticated. Welcome Aditya.');
      window.location.reload();
      return;
    }

    try {
      // Standard login check against superadmin account as fallback
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'super-admin', password }),
      });

      if (res.ok) {
        localStorage.setItem('maintenance_bypass', 'true');
        toast.success('Bypass authenticated. Welcome Aditya.');
        window.location.reload();
      } else {
        toast.error('Invalid Security Key');
        setShowLogin(false);
      }
    } catch (err) {
      toast.error('Connection Error');
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black text-[#0f0] font-mono overflow-hidden z-[9999] flex flex-col items-center justify-center text-center select-none cursor-crosshair"
      onClick={handleGlobalClick}
    >
      <canvas ref={canvasRef} className="absolute inset-0 opacity-30 pointer-events-none" />
      
      <div className="relative z-10 space-y-8 max-w-3xl p-8 bg-black/80 border border-[#0f0] shadow-[0_0_20px_rgba(0,255,0,0.2)]">
        <h1 className="text-4xl font-bold tracking-widest uppercase animate-pulse">
          {/* Welcome to Codearya Security Uploader */}
          System Infrastructure Update
        </h1>

        <div className="space-y-4">
          <p className="text-sm opacity-80 leading-relaxed">
            We apologize for the inconvenience. Our systems are currently undergoing a scheduled infrastructure upgrade to enhance performance and security.
          </p>

          <div className="text-left text-[10px] space-y-1 text-[#0a0]">
            <div>[READY] Establishing secure tunnel to origin servers...</div>
            <div className="text-yellow-500">[SYNC ] CDN propagation in progress: 42% complete</div>
            <div>[READY] Verifying encrypted data packets...</div>
            <div className="text-yellow-500">[SYNC ] Transferring main update to global edge nodes...</div>
          </div>

          <div className="relative h-8 border border-[#0f0] w-full overflow-hidden">
            <div 
              className="h-full bg-[#0f0] transition-all duration-500 shadow-[0_0_15px_#0f0]" 
              style={{ width: `${progress}%` }} 
            />
            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-black mix-blend-difference">
              {progress.toFixed(4)}% UPLOADED
            </div>
          </div>

          <p className="text-xs italic text-[#8f8]">
            Expected downtime: Approximately 8 hours.
          </p>
        </div>

        <div className="pt-4 border-t border-[#0f0] border-dashed">
          <p className="text-[10px] font-bold text-[#8f8] mb-2 uppercase">MESSAGE TO OWNER:</p>
          <p className="text-[10px] italic">
            Infrastructure synchronization is active. The website will be accessible in a few hours once the CDN setup and origin server transfers are validated.
          </p>
        </div>

        {/* <div className="border-2 border-[#0f0] p-4 bg-[#010] animate-pulse">
            <p className="text-xs mb-2">Till then, feel free to explore our official website:</p>
            <a 
              href="https://codearya.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-lg font-black hover:bg-[#0f0] hover:text-black px-4 py-2 transition-colors inline-block"
              onClick={(e) => e.stopPropagation()}
            >
              EXPLORE CODEARYA.COM
            </a>
        </div> */}
      </div>

      <div className="absolute bottom-4 left-4 right-4 h-24 overflow-hidden text-[8px] opacity-40 pointer-events-none text-left">
        {codeLines.map((line, i) => <div key={i}>{line}</div>)}
      </div>

      {showLogin && (
        <div 
          className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <form onSubmit={handleBypass} className="bg-black border-2 border-[#0f0] p-8 max-w-sm w-full space-y-6 shadow-[0_0_50px_rgba(0,255,0,0.4)]">
            <h2 className="text-xl font-bold uppercase tracking-widest text-center">Security Verification</h2>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-[#8f8]">Admin Security Key</label>
              <input 
                type="password" 
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black border border-[#0f0] p-3 text-[#0f0] focus:outline-none focus:ring-1 focus:ring-[#0f0] placeholder-[#050]"
                placeholder="••••••••••••"
              />
            </div>
            <div className="flex gap-4">
              <button 
                type="button" 
                onClick={() => setShowLogin(false)}
                className="flex-1 border border-[#0f0] p-2 uppercase text-[10px] font-bold hover:bg-[#0f0] hover:text-black transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="flex-1 bg-[#0f0] text-black p-2 uppercase text-[10px] font-bold hover:bg-[#0a0] transition-colors"
              >
                Authorize
              </button>
            </div>
          </form>
        </div>
      )}

      <footer className="absolute bottom-2 text-[8px] opacity-50">
        &copy; 2026 GLOBAL INFRASTRUCTURE CORE | ORIGIN: SERVER-SCRC-MAIN
      </footer>
    </div>
  );
};

export default MaintenancePage;
