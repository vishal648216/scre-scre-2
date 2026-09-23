import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Award } from "lucide-react";

const AttachmentCreateCertificatePage = () => (
  <DashboardLayout>
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-primary/10 flex items-center justify-center border border-primary/20 rounded-none">
          <Award className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="font-heading font-bold text-xl text-foreground uppercase tracking-tight">Create Certificate</h1>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-widest">Add a new certificate for a student</p>
        </div>
      </div>
      <Card className="rounded-none border-border">
        <CardContent className="p-8 text-center text-muted-foreground text-sm">
          Create certificate form will be added here.
        </CardContent>
      </Card>
    </div>
  </DashboardLayout>
);

export default AttachmentCreateCertificatePage;
