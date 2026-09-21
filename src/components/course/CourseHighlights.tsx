import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Clock, ClipboardList, ShieldCheck } from "lucide-react";

type Highlight = { icon: React.ComponentType<{ className?: string }>; label: string; value: string };
type Props = { items: Highlight[] };

const CourseHighlights = ({ items }: Props) => {
  const defaultItems: Highlight[] = [
    { icon: GraduationCap, label: "Qualification", value: "Certification" },
    { icon: Clock, label: "Duration", value: "3 Months" },
    { icon: ClipboardList, label: "Mode", value: "Direct / Offline" },
    { icon: ShieldCheck, label: "Exam", value: "Required" },
  ];

  const list = items.length ? items : defaultItems;

  return (
    <Card className="rounded-xl border-border">
      <CardHeader className="py-4">
        <CardTitle className="text-base font-black tracking-tight">Course Highlights</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {list.map((h) => (
          <div
            key={`${h.label}-${h.value}`}
            className="flex items-center gap-3 border border-border rounded-xl px-3 py-3 transition-all hover:-translate-y-0.5 hover:shadow-sm"
          >
            <h.icon className="w-5 h-5 text-[#F47C20]" />
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {h.label}
              </div>
              <div className="text-sm font-bold text-foreground">{h.value}</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default CourseHighlights;
