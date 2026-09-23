import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Cake, Sparkles, Send, CheckCircle2, Heart, Gift, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

interface BirthdayRecord {
  user_id: string;
  name: string;
  role: string;
  dob: string;
  course_or_designation?: string;
  center_name?: string;
  has_wished_today: boolean;
}

export function TodayBirthdaysCard() {
  const [birthdays, setBirthdays] = useState<BirthdayRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [wishingId, setWishingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTodayBirthdays();
  }, []);

  const fetchTodayBirthdays = async () => {
    try {
      const res = await apiFetch("/api/birthdays/today");
      if (res.ok) {
        const data = await res.json();
        setBirthdays(data.birthdays || []);
      }
    } catch (e) {
      console.error("Birthday fetch error", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSendWish = async (user: BirthdayRecord) => {
    setWishingId(user.user_id);
    try {
      const res = await apiFetch("/api/birthdays/send-wish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.user_id,
        }),
      });

      if (res.ok) {
        toast.success(`🎉 Birthday greeting successfully sent to ${user.name}!`);
        setBirthdays(prev =>
          prev.map(b => b.user_id === user.user_id ? { ...b, has_wished_today: true } : b)
        );
      } else {
        toast.error("Could not dispatch birthday wish.");
      }
    } catch (e) {
      toast.error("Network error sending greeting");
    } finally {
      setWishingId(null);
    }
  };

  if (loading) {
    return (
      <Card className="rounded-none border-border shadow-sm">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
          <span className="text-xs text-muted-foreground">Checking today's celebrations...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-none border-border shadow-sm overflow-hidden">
      <CardHeader className="p-4 sm:p-5 border-b bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-primary/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-pink-500/20 text-pink-600 rounded-none">
              <Cake className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                Today's Birthdays
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-none">
                  {birthdays.length} Today
                </Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Automatic and 1-click personal greetings for students & staff
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {birthdays.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            <Gift className="w-8 h-8 mx-auto mb-2 opacity-30 text-pink-500" />
            <p className="text-xs font-medium">No birthdays scheduled for today.</p>
            <p className="text-[11px] text-muted-foreground">Upcoming birthdays will appear here automatically.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {birthdays.map((person) => (
              <div
                key={person.user_id}
                className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-muted/30 transition-all"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground truncate">
                      {person.name}
                    </span>
                    <Badge variant="outline" className="text-[10px] uppercase rounded-none tracking-wider font-semibold">
                      {person.role}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {person.course_or_designation || person.center_name || "Enrolled Student"}
                  </p>
                </div>

                <div className="shrink-0">
                  {person.has_wished_today ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-1 border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Wished
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleSendWish(person)}
                      disabled={wishingId === person.user_id}
                      className="rounded-none bg-pink-600 hover:bg-pink-700 text-white gap-1.5 text-xs h-8"
                    >
                      {wishingId === person.user_id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      Send Wish
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function StudentBirthdayBanner() {
  const [greeting, setGreeting] = useState<{ is_birthday_today: boolean; name: string; message: string; wishes_received: string[] } | null>(null);

  useEffect(() => {
    fetchMyWish();
  }, []);

  const fetchMyWish = async () => {
    try {
      const res = await apiFetch("/api/birthdays/my-wish");
      if (res.ok) {
        const data = await res.json();
        if (data.is_birthday_today) {
          setGreeting(data);
        }
      }
    } catch (e) {
      console.error("Birthday check error", e);
    }
  };

  if (!greeting || !greeting.is_birthday_today) return null;

  return (
    <div className="p-5 bg-gradient-to-r from-pink-500/15 via-purple-500/15 to-amber-500/15 border-2 border-pink-500/40 rounded-none shadow-lg relative overflow-hidden mb-6 animate-in fade-in duration-500">
      <div className="absolute top-2 right-3 text-4xl opacity-20 select-none">🎂🎈✨</div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎉</span>
            <h3 className="text-lg font-bold text-pink-700 dark:text-pink-400">
              Happy Birthday, {greeting.name}!
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-foreground/80 font-medium">
            {greeting.message}
          </p>
          {greeting.wishes_received.length > 0 && (
            <p className="text-xs text-muted-foreground italic mt-2">
              Messages received today: {greeting.wishes_received.join(" | ")}
            </p>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <Badge className="bg-pink-600 text-white rounded-none px-3 py-1 text-xs">
            🎓 SCRE Birthday Star
          </Badge>
        </div>
      </div>
    </div>
  );
}
