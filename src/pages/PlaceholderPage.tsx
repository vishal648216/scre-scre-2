import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

const PlaceholderPage = ({ title }: { title: string }) => {
  return (
    <DashboardLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-in fade-in duration-500">
        <div className="w-20 h-20 bg-primary/10 flex items-center justify-center border border-primary/20">
          <Construction className="w-10 h-10 text-primary" />
        </div>
        <div className="text-center space-y-2">
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">{title}</h1>
          <p className="text-muted-foreground text-sm font-medium uppercase tracking-widest">This section is currently under development.</p>
        </div>
        <Card className="rounded-none border-border shadow-md max-w-md w-full">
          <CardContent className="p-8 text-center">
            <p className="text-xs font-bold text-muted-foreground leading-relaxed uppercase tracking-tight">
              We are working hard to bring you the full experience of the {title} module. 
              Please check back soon for updates.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default PlaceholderPage;
