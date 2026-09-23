import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { FlaskConical, List, PlusCircle, Download } from "lucide-react";

const CenterPracticalsPage = () => (
  <DashboardLayout>
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
      <div>
        <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
          Practicals
        </h1>
        <p className="text-muted-foreground mt-1 text-sm font-medium">
          Create practical assignments and view student submissions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-none border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <List className="w-8 h-8 text-primary" />
              <div>
                <p className="font-bold">All Practicals</p>
                <p className="text-sm text-muted-foreground">View all assigned practicals</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-none border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <PlusCircle className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="font-bold">Create Practical</p>
                <p className="text-sm text-muted-foreground">Assign new practical to students</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-none border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Download className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="font-bold">Submissions</p>
                <p className="text-sm text-muted-foreground">Review student submissions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-none border-border">
        <CardContent className="py-12 text-center text-muted-foreground">
          <FlaskConical className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Practical assignment and submission management will be available when the backend is configured.</p>
        </CardContent>
      </Card>
    </div>
  </DashboardLayout>
);

export default CenterPracticalsPage;
