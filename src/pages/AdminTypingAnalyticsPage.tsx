import React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { BarChart3, TrendingUp, Users, Zap, Award } from "lucide-react";
import TypingAnalyticsDashboard from "@/components/TypingAnalyticsDashboard";

const AdminTypingAnalyticsPage = () => {
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-primary" />
            Global Typing Analytics
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">System-wide performance monitoring across all centers and students.</p>
        </div>

        <TypingAnalyticsDashboard role="admin" />
      </div>
    </DashboardLayout>
  );
};

export default AdminTypingAnalyticsPage;
