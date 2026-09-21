import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import { useEffect, useState } from "react";

type CenterItem = {
  name: string;
  city?: string;
  state?: string;
  code?: string;
};

const CenterLocation = () => {
  const [centers, setCenters] = useState<CenterItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/centers");
        if (res.ok) {
          const data = await res.json();
          const list: CenterItem[] = (data || []).map((c: { name?: string; city?: string; state?: string; code?: string }) => ({
            name: c.name || "Center",
            city: c.city,
            state: c.state,
            code: (c as { code?: string }).code,
          }));
          setCenters(list.slice(0, 3));
        }
      } catch {
        setCenters([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Card className="border-border rounded-xl">
      <CardHeader className="py-3">
        <CardTitle className="text-base font-black tracking-tight">Available at Centers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading centers...</div>
        ) : centers.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Contact us to find a nearby center offering this course.
          </div>
        ) : (
          centers.map((c) => (
            <div key={`${c.name}-${c.code}`} className="border border-border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-foreground">{c.name}</div>
                {c.code && (
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Code: {c.code}
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" />
                <span>{[c.city, c.state].filter(Boolean).join(", ")}</span>
              </div>
              <a
                href="/#contact"
                className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary text-primary px-3 py-1.5 text-[11px] font-semibold"
              >
                View Center
              </a>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default CenterLocation;
