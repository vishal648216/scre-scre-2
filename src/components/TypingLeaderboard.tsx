import React, { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { Loader2, Trophy, Zap, Target, Medal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface TypingResult {
  _id: string;
  student_name?: string;
  wpm: number;
  accuracy: number;
  language_id: string;
}

const TypingLeaderboard = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<TypingResult[]>([]);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const res = await apiFetch("/api/typing/leaderboard");
      if (res.ok) {
        setResults(await res.json());
      }
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/10">
            <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Rank")}</th>
            <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Student")}</th>
            <th className="text-center px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Speed")}</th>
            <th className="text-center px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Accuracy")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {results.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-10 text-center opacity-60 text-xs font-black uppercase tracking-widest">{t("No data available")}</td>
            </tr>
          ) : (
            results.map((res, index) => (
              <tr key={res._id} className="hover:bg-muted/20 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {index < 3 ? (
                      <Medal className={cn(
                        "w-5 h-5",
                        index === 0 ? "text-amber-500" : index === 1 ? "text-slate-400" : "text-amber-700"
                      )} />
                    ) : (
                      <span className="text-xs font-black text-muted-foreground">#{index + 1}</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="font-black uppercase text-xs tracking-tight">{t(res.student_name || "Student")}</span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="px-3 py-1 font-black text-xs rounded-none border border-primary/20 bg-primary/5 text-primary">
                    {Math.round(res.wpm)} {t("WPM")}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="font-black text-xs text-foreground">{Math.round(res.accuracy)}%</span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TypingLeaderboard;
