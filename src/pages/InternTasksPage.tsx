
import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListTodo, Loader2, CheckCircle2, Clock, AlertCircle, Calendar, Edit } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Task {
  _id: any;
  title: string;
  description: string;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  remarks: string | null;
}

const InternTasksPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [updateForm, setUpdateForm] = useState({
    status: "",
    remarks: ""
  });

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/api/intern-tasks");
      const data = await response.json();
      if (response.ok) {
        setTasks(data);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;

    setLoading(true);
    try {
      const res = await apiFetch(`/api/intern-tasks/${selectedTask._id}/status`, {
        method: "PATCH",
        body: JSON.stringify(updateForm)
      });

      if (res.ok) {
        toast.success("Task updated successfully!");
        setIsModalOpen(false);
        setSelectedTask(null);
        fetchTasks(); // Refresh tasks
      } else {
        toast.error("Failed to update task");
      }
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error("An error occurred while updating the task");
    } finally {
      setLoading(false);
    }
  };

  const openUpdateModal = (task: Task) => {
    setSelectedTask(task);
    setUpdateForm({
      status: task.status,
      remarks: task.remarks || ""
    });
    setIsModalOpen(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case "in_progress": return <Clock className="w-5 h-5 text-amber-500" />;
      case "pending": return <AlertCircle className="w-5 h-5 text-blue-500" />;
      default: return <ListTodo className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-emerald-500/10 text-emerald-500 border-emerald-500/30";
      case "in_progress": return "bg-amber-500/10 text-amber-500 border-amber-500/30";
      case "pending": return "bg-blue-500/10 text-blue-500 border-blue-500/30";
      default: return "bg-muted/50 text-muted-foreground border-border";
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">{t("My Tasks")}</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">{t("View and manage your assigned tasks.")}</p>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-12 text-center border border-border bg-card">
            <ListTodo className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm font-medium text-muted-foreground">{t("No tasks assigned yet.")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <Card key={String(task._id)} className="rounded-none border-border shadow-sm">
                <CardHeader className="bg-muted/30 border-b border-border py-4 px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(task.status)}
                      <CardTitle className="text-sm font-black uppercase tracking-widest">{task.title}</CardTitle>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "px-3 py-1 text-[10px] font-black uppercase tracking-widest border rounded-sm",
                        getStatusBadgeColor(task.status)
                      )}>
                        {t(task.status)}
                      </span>
                      <Button
                        variant="default"
                        size="icon"
                        onClick={() => openUpdateModal(task)}
                        className="w-8 h-8"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <p className="text-sm text-muted-foreground">{task.description}</p>
                  {task.due_date && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4" />
                      <span>{t("Due")}: {format(new Date(task.due_date), "MMMM d, yyyy")}</span>
                    </div>
                  )}
                  {task.remarks && (
                    <div className="p-4 bg-muted/50 border border-border rounded-sm">
                      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">{t("Remarks")}</p>
                      <p className="text-sm">{task.remarks}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Update Task Modal */}
        {selectedTask && (
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-heading font-black text-xl uppercase tracking-tight">
                  {t("Update Task")}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpdateTask} className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="taskTitle" className="text-xs font-black uppercase tracking-widest">
                      {t("Task Title")}
                    </Label>
                    <div className="px-4 py-3 bg-muted/30 border border-border rounded-sm text-sm font-bold">
                      {selectedTask.title}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="status" className="text-xs font-black uppercase tracking-widest">
                      {t("Status")}
                    </Label>
                    <Select
                      value={updateForm.status}
                      onValueChange={(value) => setUpdateForm({ ...updateForm, status: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("Select status")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">{t("Pending")}</SelectItem>
                        <SelectItem value="in_progress">{t("In Progress")}</SelectItem>
                        <SelectItem value="completed">{t("Completed")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="remarks" className="text-xs font-black uppercase tracking-widest">
                      {t("Remarks")}
                    </Label>
                    <Textarea
                      id="remarks"
                      value={updateForm.remarks}
                      onChange={(e) => setUpdateForm({ ...updateForm, remarks: e.target.value })}
                      placeholder={t("Add remarks about the task...")}
                      rows={4}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => setIsModalOpen(false)}
                    disabled={loading}
                  >
                    {t("Cancel")}
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading || !updateForm.status}
                    className="bg-primary"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {t("Update Task")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </DashboardLayout>
  );
};

export default InternTasksPage;
