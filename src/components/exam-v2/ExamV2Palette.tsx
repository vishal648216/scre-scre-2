import { cn } from "@/lib/utils";

export type PaletteStatus = "current" | "answered" | "review" | "empty";

export function paletteStatus(args: {
  index: number;
  currentIdx: number;
  hasAnswer: boolean;
  markedReview: boolean;
}): PaletteStatus {
  if (args.index === args.currentIdx) return "current";
  if (args.markedReview) return "review";
  if (args.hasAnswer) return "answered";
  return "empty";
}

export function ExamV2Palette({
  total,
  currentIdx,
  getStatus,
  onPick,
  cols = 5,
}: {
  total: number;
  currentIdx: number;
  getStatus: (i: number) => PaletteStatus;
  onPick: (i: number) => void;
  cols?: number;
}) {
  return (
    <div className="space-y-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Question palette</p>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: total }, (_, i) => {
          const st = getStatus(i);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPick(i)}
              className={cn(
                "aspect-square min-h-[2.25rem] rounded-lg text-xs font-bold transition-all duration-150 border shadow-sm",
                st === "current" &&
                  "bg-indigo-600 text-white border-indigo-700 ring-2 ring-indigo-400/50 scale-[1.02] z-10",
                st === "answered" && st !== "current" && "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100",
                st === "review" && st !== "current" && "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100",
                st === "empty" && "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-slate-50",
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="space-y-2 text-[10px] text-slate-500 border-t border-slate-200/80 pt-3">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-indigo-600" /> Current
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-emerald-200 border border-emerald-300" /> Answered
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-amber-200 border border-amber-300" /> Review
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-white border border-slate-200" /> Not visited
        </div>
      </div>
    </div>
  );
}
