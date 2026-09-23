import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

interface VirtualKeyboardProps {
  nextChar?: string;
  keyboardLayout?: string;
  onKeyPress?: (key: string) => void;
  fontFamily?: string;
  hideKeyHints?: boolean;
}

// Finger color maps for typing practice guidance
const fingerColors: Record<string, string> = {
  lp: "bg-pink-500/10 border-pink-500/30 text-pink-600 dark:text-pink-400", // Left Pinky
  lr: "bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400", // Left Ring
  lm: "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400", // Left Middle
  li: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400", // Left Index
  ri: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400", // Right Index
  rm: "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400", // Right Middle
  rr: "bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400", // Right Ring
  rp: "bg-pink-500/10 border-pink-500/30 text-pink-600 dark:text-pink-400", // Right Pinky
  thumb: "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400", // Thumb (Space)
};

interface KeyDef {
  key: string;
  shiftKey?: string;
  width?: string;
  finger?: string;
}

const qwertyRows: KeyDef[][] = [
  [
    { key: "`", shiftKey: "~", finger: "lp" },
    { key: "1", shiftKey: "!", finger: "lp" },
    { key: "2", shiftKey: "@", finger: "lr" },
    { key: "3", shiftKey: "#", finger: "lm" },
    { key: "4", shiftKey: "$", finger: "li" },
    { key: "5", shiftKey: "%", finger: "li" },
    { key: "6", shiftKey: "^", finger: "ri" },
    { key: "7", shiftKey: "&", finger: "ri" },
    { key: "8", shiftKey: "*", finger: "rm" },
    { key: "9", shiftKey: "(", finger: "rr" },
    { key: "0", shiftKey: ")", finger: "rp" },
    { key: "-", shiftKey: "_", finger: "rp" },
    { key: "=", shiftKey: "+", finger: "rp" },
    { key: "Backspace", width: "w-16 sm:w-20", finger: "rp" },
  ],
  [
    { key: "Tab", width: "w-12 sm:w-16", finger: "lp" },
    { key: "q", shiftKey: "Q", finger: "lp" },
    { key: "w", shiftKey: "W", finger: "lr" },
    { key: "e", shiftKey: "E", finger: "lm" },
    { key: "r", shiftKey: "R", finger: "li" },
    { key: "t", shiftKey: "T", finger: "li" },
    { key: "y", shiftKey: "Y", finger: "ri" },
    { key: "u", shiftKey: "U", finger: "ri" },
    { key: "i", shiftKey: "I", finger: "rm" },
    { key: "o", shiftKey: "O", finger: "rr" },
    { key: "p", shiftKey: "P", finger: "rp" },
    { key: "[", shiftKey: "{", finger: "rp" },
    { key: "]", shiftKey: "}", finger: "rp" },
    { key: "\\", shiftKey: "|", finger: "rp" },
  ],
  [
    { key: "Caps", width: "w-14 sm:w-18", finger: "lp" },
    { key: "a", shiftKey: "A", finger: "lp" },
    { key: "s", shiftKey: "S", finger: "lr" },
    { key: "d", shiftKey: "D", finger: "lm" },
    { key: "f", shiftKey: "F", finger: "li" },
    { key: "g", shiftKey: "G", finger: "li" },
    { key: "h", shiftKey: "H", finger: "ri" },
    { key: "j", shiftKey: "J", finger: "ri" },
    { key: "k", shiftKey: "K", finger: "rm" },
    { key: "l", shiftKey: "L", finger: "rr" },
    { key: ";", shiftKey: ":", finger: "rp" },
    { key: "'", shiftKey: '"', finger: "rp" },
    { key: "Enter", width: "w-16 sm:w-24", finger: "rp" },
  ],
  [
    { key: "Shift", width: "w-16 sm:w-24", finger: "lp" },
    { key: "z", shiftKey: "Z", finger: "lp" },
    { key: "x", shiftKey: "X", finger: "lr" },
    { key: "c", shiftKey: "C", finger: "lm" },
    { key: "v", shiftKey: "V", finger: "li" },
    { key: "b", shiftKey: "B", finger: "li" },
    { key: "n", shiftKey: "N", finger: "ri" },
    { key: "m", shiftKey: "M", finger: "ri" },
    { key: ",", shiftKey: "<", finger: "rm" },
    { key: ".", shiftKey: ">", finger: "rr" },
    { key: "/", shiftKey: "?", finger: "rp" },
    { key: "Shift", width: "w-16 sm:w-24", finger: "rp" },
  ],
  [
    { key: "Space", width: "w-48 sm:w-72", finger: "thumb" }
  ]
];

// InScript Layout mappings (Devanagari / Hindi)
const inscriptRows: KeyDef[][] = [
  [
    { key: "`", shiftKey: "1", finger: "lp" },
    { key: "1", shiftKey: "ऍ", finger: "lp" },
    { key: "2", shiftKey: "ॅ", finger: "lr" },
    { key: "3", shiftKey: "्र", finger: "lm" },
    { key: "4", shiftKey: "र्", finger: "li" },
    { key: "5", shiftKey: "ज्ञ", finger: "li" },
    { key: "6", shiftKey: "त्र", finger: "ri" },
    { key: "7", shiftKey: "क्ष", finger: "ri" },
    { key: "8", shiftKey: "श्र", finger: "rm" },
    { key: "9", shiftKey: "(", finger: "rr" },
    { key: "0", shiftKey: ")", finger: "rp" },
    { key: "-", shiftKey: "ः", finger: "rp" },
    { key: "ऋ", shiftKey: "ऋ", finger: "rp" },
    { key: "Backspace", width: "w-16 sm:w-20", finger: "rp" },
  ],
  [
    { key: "Tab", width: "w-12 sm:w-16", finger: "lp" },
    { key: "ौ", shiftKey: "औ", finger: "lp" },
    { key: "ै", shiftKey: "ऐ", finger: "lr" },
    { key: "ा", shiftKey: "आ", finger: "lm" },
    { key: "ी", shiftKey: "ई", finger: "li" },
    { key: "ू", shiftKey: "ऊ", finger: "li" },
    { key: "ब", shiftKey: "भ", finger: "ri" },
    { key: "ह", shiftKey: "ङ", finger: "ri" },
    { key: "ग", shiftKey: "घ", finger: "rm" },
    { key: "द", shiftKey: "ध", finger: "rr" },
    { key: "ज", shiftKey: "झ", finger: "rp" },
    { key: "ड", shiftKey: "ढ", finger: "rp" },
    { key: "़", shiftKey: "ञ", finger: "rp" },
    { key: "\\", shiftKey: "|", finger: "rp" },
  ],
  [
    { key: "Caps", width: "w-14 sm:w-18", finger: "lp" },
    { key: "ो", shiftKey: "ओ", finger: "lp" },
    { key: "े", shiftKey: "ए", finger: "lr" },
    { key: "्", shiftKey: "अ", finger: "lm" },
    { key: "ि", shiftKey: "इ", finger: "li" },
    { key: "ु", shiftKey: "उ", finger: "li" },
    { key: "प", shiftKey: "फ", finger: "ri" },
    { key: "र", shiftKey: "ऱ", finger: "ri" },
    { key: "क", shiftKey: "ख", finger: "rm" },
    { key: "त", shiftKey: "थ", finger: "rr" },
    { key: "च", shiftKey: "छ", finger: "rp" },
    { key: "ट", shiftKey: "ठ", finger: "rp" },
    { key: "Enter", width: "w-16 sm:w-24", finger: "rp" },
  ],
  [
    { key: "Shift", width: "w-16 sm:w-24", finger: "lp" },
    { key: "ं", shiftKey: "ँ", finger: "lp" },
    { key: "म", shiftKey: "ण", finger: "lr" },
    { key: "न", shiftKey: "ऩ", finger: "lm" },
    { key: "व", shiftKey: "ऴ", finger: "li" },
    { key: "ल", shiftKey: "ळ", finger: "li" },
    { key: "स", shiftKey: "श", finger: "ri" },
    { key: "य", shiftKey: "य", finger: "ri" },
    { key: "श", shiftKey: "ष", finger: "rm" },
    { key: ".", shiftKey: "|", finger: "rr" },
    { key: "/", shiftKey: "?", finger: "rp" },
    { key: "Shift", width: "w-16 sm:w-24", finger: "rp" },
  ],
  [
    { key: "Space", width: "w-48 sm:w-72", finger: "thumb" }
  ]
];

export function VirtualKeyboard({ nextChar, keyboardLayout = "QWERTY", onKeyPress, fontFamily, hideKeyHints = false }: VirtualKeyboardProps) {
  const [capsLock, setCapsLock] = useState(false);
  const [shift, setShift] = useState(false);

  const isDevanagariInscript = useMemo(() => {
    const l = keyboardLayout.toLowerCase();
    return l.includes("inscript") || l.includes("mangal") || l.includes("hindi");
  }, [keyboardLayout]);

  const rows = isDevanagariInscript ? inscriptRows : qwertyRows;

  // Determine which key matches nextChar
  const targetKeyInfo = useMemo(() => {
    if (hideKeyHints || !nextChar) return null;
    if (nextChar === " ") return { key: "Space", needShift: false };

    for (const row of rows) {
      for (const k of row) {
        if (k.key === nextChar) return { key: k.key, needShift: false, finger: k.finger };
        if (k.shiftKey === nextChar) return { key: k.key, needShift: true, finger: k.finger };
        if (k.key.toLowerCase() === nextChar.toLowerCase()) {
          const isUpper = nextChar === nextChar.toUpperCase() && nextChar !== nextChar.toLowerCase();
          return { key: k.key, needShift: isUpper, finger: k.finger };
        }
      }
    }
    return null;
  }, [nextChar, rows, hideKeyHints]);

  const fingerLabels: Record<string, string> = {
    lp: "Left Pinky",
    lr: "Left Ring",
    lm: "Left Middle",
    li: "Left Index",
    ri: "Right Index",
    rm: "Right Middle",
    rr: "Right Ring",
    rp: "Right Pinky",
    thumb: "Thumb (Spacebar)",
  };

  return (
    <div className="w-full bg-card/90 border border-border/80 p-3 sm:p-4 rounded-none shadow-2xl space-y-3 font-sans select-none">
      <div className="flex justify-between items-center px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Layout: <span className="text-foreground font-extrabold">{keyboardLayout}</span>
        </span>
        {targetKeyInfo && !hideKeyHints && (
          <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-3 py-1 text-[10px] text-primary font-black">
            <span>Next Key:</span>
            <span className="bg-primary text-primary-foreground px-2 py-0.5 font-mono font-bold text-xs rounded-none">
              {targetKeyInfo.needShift ? "SHIFT + " : ""}{targetKeyInfo.key === "Space" ? "SPACEBAR" : nextChar}
            </span>
            {targetKeyInfo.finger && (
              <span className="opacity-80 font-normal border-l border-primary/30 pl-2">
                Finger: {fingerLabels[targetKeyInfo.finger]}
              </span>
            )}
          </div>
        )}
        {hideKeyHints && (
          <span className="text-[10px] font-black uppercase text-amber-600 tracking-wider">
            Hard Exam Mode: Keyboard Hints Hidden
          </span>
        )}
      </div>

      <div className="space-y-1.5 flex flex-col items-center overflow-x-auto pb-1">
        {rows.map((row, rIdx) => (
          <div key={rIdx} className="flex gap-1 justify-center w-full min-w-max">
            {row.map((kDef, kIdx) => {
              const keyLabel = shift || capsLock ? (kDef.shiftKey || kDef.key.toUpperCase()) : kDef.key;
              const isTarget = !hideKeyHints && (targetKeyInfo?.key === kDef.key || (kDef.key === "Space" && nextChar === " "));
              const isShiftTarget = !hideKeyHints && targetKeyInfo?.needShift && kDef.key === "Shift";

              const fingerStyle = kDef.finger && !hideKeyHints ? fingerColors[kDef.finger] : "bg-muted/40 border-border text-foreground";

              return (
                <button
                  key={kIdx}
                  type="button"
                  onClick={() => {
                    if (kDef.key === "Caps") setCapsLock(!capsLock);
                    else if (kDef.key === "Shift") setShift(!shift);
                    else {
                      const charToType = kDef.key === "Space" ? " " : keyLabel;
                      onKeyPress?.(charToType);
                    }
                  }}
                  style={{ fontFamily: fontFamily || "inherit" }}
                  className={cn(
                    "h-10 sm:h-12 px-2 flex flex-col items-center justify-center border font-bold text-xs sm:text-sm rounded-none transition-all duration-150 shadow-sm relative group",
                    kDef.width || "w-8 sm:w-11",
                    fingerStyle,
                    (isTarget || isShiftTarget) && "ring-4 ring-primary ring-offset-2 ring-offset-background bg-primary text-primary-foreground font-black scale-105 z-10 shadow-lg animate-pulse",
                    kDef.key === "Space" && "text-[10px] tracking-widest uppercase font-mono"
                  )}
                >
                  <span className="leading-none">{keyLabel === "Space" ? "SPACE" : keyLabel}</span>
                  {kDef.shiftKey && kDef.shiftKey !== kDef.key.toUpperCase() && !isDevanagariInscript && (
                    <span className="text-[9px] opacity-50 leading-none absolute top-1 right-1 font-mono">
                      {kDef.shiftKey}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default VirtualKeyboard;
