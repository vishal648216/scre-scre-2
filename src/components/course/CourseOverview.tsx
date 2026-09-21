import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  overview: string;
  subjects?: string[];
};

const CourseOverview = ({ overview, subjects = [] }: Props) => {
  const list = subjects.length
    ? subjects
    : ["Computer Fundamentals", "Operating System Basics", "Office Suite", "Internet & Digital Skills"];

  return (
    <Card className="rounded-xl border-border">
      <CardHeader className="py-4">
        <CardTitle className="text-base font-black tracking-tight">About This Course</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
        <div className="text-foreground font-semibold">Course Overview</div>
        <p>{overview}</p>
        <div className="text-foreground font-semibold mt-4">Subjects Covered</div>
        <ul className="list-disc pl-5 space-y-1">
          {list.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

export default CourseOverview;
