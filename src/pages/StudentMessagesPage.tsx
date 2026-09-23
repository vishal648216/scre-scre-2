import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

const StudentMessagesPage = () => (
  <DashboardLayout>
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
      <div>
        <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
          Messages
        </h1>
        <p className="text-muted-foreground mt-1 text-sm font-medium">
          Direct messages from your center or instructors.
        </p>
      </div>

      <Card className="rounded-none border-border">
        <CardContent className="py-12 text-center text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Messaging will be available when the feature is configured. Check Announcements for updates.</p>
        </CardContent>
      </Card>
    </div>
  </DashboardLayout>
);

export default StudentMessagesPage;
