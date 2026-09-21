
import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  Users,
  User
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

interface InternProgress {
  intern_id: string;
  intern_name: string;
  attendance_percentage: number;
  total_tasks: number;
  pending_tasks: number;
  in_progress_tasks: number;
  completed_tasks: number;
  task_completion_rate: number;
  overall_progress_percentage: number;
}

const getProgressColor = (percentage: number) => {
  if (percentage >= 80) return "bg-green-500";
  if (percentage >= 60) return "bg-yellow-500";
  if (percentage >= 40) return "bg-orange-500";
  return "bg-red-500";
};

const InternProgressPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [progressData, setProgressData] = useState<InternProgress[]>([]);

  useEffect(() => {
    fetchProgress();
  }, []);

  const fetchProgress = async () => {
    try {
      const res = await apiFetch("/api/interns/progress");
      if (res.ok) {
        const data = await res.json();
        setProgressData(data);
      }
    } catch (error) {
      console.error("Error fetching intern progress:", error);
      toast.error("Failed to load progress data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
              {t("Intern Progress")}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              {t("Track progress of all interns")}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="rounded-none border-border shadow-sm">
                <CardHeader className="bg-muted/30 border-b border-border py-4 px-6">
                  <Skeleton className="h-6 w-3/4" />
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <Skeleton className="h-16 w-full" />
                  <div className="grid grid-cols-3 gap-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : progressData.length === 0 ? (
          <Card className="rounded-none border-border shadow-md">
            <CardContent className="p-12 text-center">
              <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm font-medium text-muted-foreground">
                {t("No interns to track progress for")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {progressData.map((intern) => (
              <Card key={intern.intern_id} className="rounded-none border-border shadow-sm">
                <CardHeader className="bg-muted/30 border-b border-border py-4 px-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold">
                        {intern.intern_name}
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        {t("Overall Progress")}
                      </span>
                      <span className="text-xl font-extrabold text-foreground">
                        {intern.overall_progress_percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-muted/50 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all duration-500 ${getProgressColor(intern.overall_progress_percentage)}`}
                        style={{ width: `${Math.min(intern.overall_progress_percentage, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-muted/20 rounded-lg p-3 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Calendar className="w-4 h-4 text-blue-500" />
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          {t("Attendance")}
                        </span>
                      </div>
                      <span className="text-lg font-extrabold text-blue-600">
                        {intern.attendance_percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="bg-muted/20 rounded-lg p-3 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          {t("Tasks Done")}
                        </span>
                      </div>
                      <span className="text-lg font-extrabold text-green-600">
                        {intern.completed_tasks}/{intern.total_tasks}
                      </span>
                    </div>
                    <div className="bg-muted/20 rounded-lg p-3 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          {t("Completion")}
                        </span>
                      </div>
                      <span className="text-lg font-extrabold text-emerald-600">
                        {intern.task_completion_rate.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-1">
                        <AlertCircle className="w-4 h-4 text-blue-500" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        {t("Pending")}
                      </span>
                      <p className="text-lg font-extrabold text-blue-500">
                        {intern.pending_tasks}
                      </p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-1">
                        <Clock className="w-4 h-4 text-yellow-500" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        {t("In Progress")}
                      </span>
                      <p className="text-lg font-extrabold text-yellow-500">
                        {intern.in_progress_tasks}
                      </p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-1">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        {t("Completed")}
                      </span>
                      <p className="text-lg font-extrabold text-green-500">
                        {intern.completed_tasks}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default InternProgressPage;
