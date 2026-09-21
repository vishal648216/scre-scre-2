import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Video, Calendar, History } from "lucide-react";

const StudentLiveClassesPage = () => (
  <DashboardLayout>
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
      <div>
        <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
          Live Classes
        </h1>
        <p className="text-muted-foreground mt-1 text-sm font-medium">
          Join scheduled live classes and view your class history.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-none border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Video className="w-8 h-8 text-primary" />
              <div>
                <p className="font-bold">Join Class</p>
                <p className="text-sm text-muted-foreground">Join an ongoing live session</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-none border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="font-bold">Class Schedule</p>
                <p className="text-sm text-muted-foreground">Upcoming live classes</p>
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
                <p className="text-sm text-muted-foreground">Past sessions attended</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-none border-border">
        <CardContent className="py-12 text-center text-muted-foreground">
          <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Live class links will appear here when your center schedules sessions.</p>
        </CardContent>
      </Card>
    </div>
  </DashboardLayout>
);

export default StudentLiveClassesPage;
