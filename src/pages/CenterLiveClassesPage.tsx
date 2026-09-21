import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Video, Calendar, History } from "lucide-react";

const CenterLiveClassesPage = () => (
  <DashboardLayout>
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
      <div>
        <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
          Live Classes
        </h1>
        <p className="text-muted-foreground mt-1 text-sm font-medium">
          Schedule and manage live classes for your students.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="rounded-none border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-primary" />
              <div>
                <p className="font-bold">Schedule Class</p>
                <p className="text-sm text-muted-foreground">
                  Create a new live class session. Integrate with video platform (Zoom/Meet) when backend is ready.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-none border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <History className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="font-bold">Class History</p>
                <p className="text-sm text-muted-foreground">
                  View past live class sessions and attendance.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-none border-border">
        <CardContent className="py-12 text-center text-muted-foreground">
          <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Live class scheduling will be available when the video integration backend is configured.</p>
        </CardContent>
      </Card>
    </div>
  </DashboardLayout>
);

export default CenterLiveClassesPage;
