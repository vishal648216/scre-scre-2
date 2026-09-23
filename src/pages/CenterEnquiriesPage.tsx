import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, Mail, UserCheck, ArrowRight } from "lucide-react";

const CenterEnquiriesPage = () => (
  <DashboardLayout>
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
      <div>
        <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
          Enquiries
        </h1>
        <p className="text-muted-foreground mt-1 text-sm font-medium">
          Manage leads and enquiries. Admin manages all enquiries in CRM.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-none border-border hover:border-primary/30 transition-colors">
          <Link to="/dashboard/crm/enquiries" className="block">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Mail className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-bold">All Enquiries</p>
                  <p className="text-xs text-muted-foreground">View in CRM (Admin)</p>
                </div>
                <ArrowRight className="w-4 h-4 ml-auto" />
              </div>
            </CardContent>
          </Link>
        </Card>
        <Card className="rounded-none border-border opacity-75">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="font-bold">Follow-ups</p>
                <p className="text-xs text-muted-foreground">Track in CRM</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-none border-border opacity-75">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <UserCheck className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="font-bold">Converted Leads</p>
                <p className="text-xs text-muted-foreground">View in CRM</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-none border-border">
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">
            Enquiries from the website contact form are managed by Admin in the CRM section. Centers can view and follow up on enquiries assigned to them once that feature is enabled.
          </p>
        </CardContent>
      </Card>
    </div>
  </DashboardLayout>
);

export default CenterEnquiriesPage;
