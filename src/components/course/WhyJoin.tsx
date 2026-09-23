import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

type Props = { points?: string[] };

const WhyJoin = ({ points }: Props) => {
  const list =
    points && points.length
      ? points
      : ["Expert Faculty", "Practical Training", "Job Assistance", "Recognized Certificate", "Industry Curriculum"];

  return (
    <Card className="border-border rounded-xl">
      <CardHeader className="py-3">
        <CardTitle className="text-base font-black tracking-tight">Why Join This Course?</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {list.map((w) => (
          <div
            key={w}
            className="flex items-center gap-2 text-sm transition-all hover:-translate-y-0.5"
          >
            <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
            <span className="text-muted-foreground">{w}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default WhyJoin;
