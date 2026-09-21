import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Video } from "lucide-react";

const StudentRecordedClassesPage = () => (
  <DashboardLayout>
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
      <div>
        <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
          Recorded Classes
        </h1>
        <p className="text-muted-foreground mt-1 text-sm font-medium">
          Watch recorded sessions from past live classes.
        </p>
      </div>

      <Card className="rounded-none border-border">
        <CardContent className="py-12 text-center text-muted-foreground">
          <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Recorded class videos will appear here when your center uploads them.</p>
        </CardContent>
      </Card>
    </div>
  </DashboardLayout>
);

export default StudentRecordedClassesPage;
