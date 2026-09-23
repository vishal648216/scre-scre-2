
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ListTodo,
  Plus,
  Loader2,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  Users,
  Briefcase,
  X
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Task {
  _id: any;
  internId: string;
  title: string;
  description: string;
  status: string;
  dueDate: string | null;
  completedAt: string | null;
  remarks: string | null;
}

interface Intern {
  _id: any;
  fullName: string;
  email: string;
}

const InternTasksManagerPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [interns, setInterns] = useState<Intern[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState({
    internId: "",
    title: "",
    description: "",
    dueDate: ""
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [tasksRes, internsRes] = await Promise.all([
          apiFetch("/api/intern-tasks"),
          apiFetch("/api/interns")
        ]);

        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          setTasks(tasksData);
        }

        if (internsRes.ok) {
          const internsData = await internsRes.json();
          setInterns(internsData);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const method = editingTask ? "PUT" : "POST";
      const url = editingTask
        ? `/api/intern-tasks/${editingTask._id}`
        : "/api/intern-tasks";

      const payload = {
        ...formData,
        dueDate: formData.dueDate || null
      };

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success(
          editingTask ? "Task updated successfully!" : "Task created successfully!"
        );
        setIsModalOpen(false);
        setEditingTask(null);
        setFormData({
          internId: "",
          title: "",
          description: "",
          dueDate: ""
        });

        // Refresh tasks list
        const tasksRes = await apiFetch("/api/intern-tasks");
        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          setTasks(tasksData);
        }
      } else {
        toast.error("Failed to save task");
      }
    } catch (error) {
      console.error("Error saving task:", error);
      toast.error("An error occurred while saving the task");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!window.confirm(t("Are you sure you want to delete this task?"))) return;

    try {
      const res = await apiFetch(`/api/intern-tasks/${taskId}`, {
        method: "DELETE"
      });

      if (res.ok) {
        toast.success(t("Task deleted successfully!"));
        setTasks(tasks.filter((t) => t._id !== taskId));
      } else {
        toast.error(t("Failed to delete task"));
      }
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error(t("An error occurred while deleting the task"));
    }
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setFormData({
      internId: task.internId,
      title: task.title,
      description: task.description,
      dueDate: task.dueDate
        ? format(new Date(task.dueDate), "yyyy-MM-dd")
        : ""
    });
    setIsModalOpen(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case "in_progress":
        return <Clock className="w-5 h-5 text-amber-500" />;
      case "pending":
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
      default:
        return <ListTodo className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/30";
      case "in_progress":
        return "bg-amber-500/10 text-amber-500 border-amber-500/30";
      case "pending":
        return "bg-blue-500/10 text-blue-500 border-blue-500/30";
      default:
        return "bg-muted/50 text-muted-foreground border-border";
    }
  };

  const getInternName = (internId: string) => {
    const intern = interns.find((i) => i._id === internId);
    return intern ? intern.fullName : t("Unknown Intern");
  };

  if (loading && !tasks.length) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
              {t("Intern Tasks")}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              {t("Manage and assign tasks to interns")}
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingTask(null);
              setFormData({
                internId: "",
                title: "",
                description: "",
                dueDate: ""
              });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-none font-heading font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:opacity-90 transition-all"
          >
            <Plus className="w-4 h-4" />
            {t("Add Task")}
          </Button>
        </div>

        <Card className="rounded-none border-border shadow-md overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border py-4">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-primary" />
              {t("Tasks List")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {tasks.length === 0 ? (
              <div className="p-12 text-center border border-border bg-card">
                <ListTodo className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm font-medium text-muted-foreground">
                  {t("No tasks assigned yet. Create your first task!")}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {tasks.map((task) => (
                  <Card
                    key={task._id}
                    className="rounded-none border-border shadow-sm"
                  >
                    <CardHeader className="bg-muted/30 border-b border-border py-4 px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(task.status)}
                          <div>
                            <CardTitle className="text-sm font-black uppercase tracking-widest">
                              {task.title}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">
                              {t("Assigned to")}: {getInternName(task.internId)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              "px-3 py-1 text-[10px] font-black uppercase tracking-widest border rounded-sm " +
                              getStatusBadgeColor(task.status)
                            }
                          >
                            {task.status}
                          </span>
                          <Button
                            variant="default"
                            size="icon"
                            onClick={() => handleEdit(task)}
                            className="w-8 h-8"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="default"
                            size="icon"
                            onClick={() => handleDelete(task._id)}
                            className="w-8 h-8"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      <p className="text-sm text-muted-foreground">
                        {task.description}
                      </p>
                      {task.dueDate && (
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {t("Due")}: {format(new Date(task.dueDate), "MMMM d, yyyy")}
                          </span>
                        </div>
                      )}
                      {task.remarks && (
                        <div className="p-4 bg-muted/50 border border-border rounded-sm">
                          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">
                            {t("Remarks")}
                          </p>
                          <p className="text-sm">{task.remarks}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Task Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-heading font-black text-xl uppercase tracking-tight">
                {editingTask ? t("Edit Task") : t("Add New Task")}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="intern" className="text-xs font-black uppercase tracking-widest">
                    {t("Select Intern")} *
                  </Label>
                  <Select
                    value={formData.internId}
                    onValueChange={(value) => setFormData({ ...formData, internId: value })}
                    required
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("Select an intern")} />
                    </SelectTrigger>
                    <SelectContent>
                      {interns.map((intern) => (
                        <SelectItem key={intern._id} value={intern._id}>
                          {intern.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="title" className="text-xs font-black uppercase tracking-widest">
                    {t("Task Title")} *
                  </Label>
                  <Input
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description" className="text-xs font-black uppercase tracking-widest">
                    {t("Task Description")}
                  </Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                  />
                </div>

                <div>
                  <Label htmlFor="dueDate" className="text-xs font-black uppercase tracking-widest">
                    {t("Due Date")}
                  </Label>
                  <Input
                    id="dueDate"
                    name="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
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
                  disabled={loading || !formData.internId || !formData.title}
                  className="bg-primary"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {editingTask ? t("Update Task") : t("Create Task")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default InternTasksManagerPage;
