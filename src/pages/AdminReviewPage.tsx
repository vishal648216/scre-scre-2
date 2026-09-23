import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, Loader2, Trash2, CheckCircle, XCircle, MessageSquare, User, Calendar } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Review {
  _id: string;
  student_id: string;
  student_name: string;
  student_photo?: string;
  rating: number;
  comment: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

const AdminReviewPage = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const getId = (id: any): string => {
    if (typeof id === 'string') return id;
    if (id?.$oid) return id.$oid;
    return String(id);
  };

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/reviews");
      if (res.ok) {
        const data = await res.json();
        // Ensure IDs are strings
        const processedData = data.map((r: any) => ({
          ...r,
          _id: getId(r._id)
        }));
        setReviews(processedData);
      }
    } catch (error) {
      toast.error("Failed to load reviews");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleStatusUpdate = async (id: string, status: string) => {
    setActionLoading(id);
    try {
      const res = await apiFetch(`/api/reviews/${id}/${status}`, {
        method: "PATCH",
      });
      if (res.ok) {
        toast.success(`Review ${status} successfully`);
        fetchReviews();
      } else {
        toast.error("Failed to update status");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this review?")) return;
    
    setActionLoading(id);
    try {
      const res = await apiFetch(`/api/reviews/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Review deleted successfully");
        fetchReviews();
      } else {
        toast.error("Failed to delete review");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <DashboardLayout role="Admin">
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-primary" />
              Manage Student Reviews
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium uppercase tracking-wider">
              Review, approve, or delete student success stories and feedback.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Loading reviews...</p>
          </div>
        ) : reviews.length === 0 ? (
          <Card className="rounded-none border-dashed border-2 border-border bg-muted/20">
            <CardContent className="py-20 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-background border border-border flex items-center justify-center mb-6">
                <MessageSquare className="w-8 h-8 text-muted-foreground opacity-20" />
              </div>
              <h3 className="text-lg font-bold uppercase tracking-tight">No Reviews Yet</h3>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-2 uppercase tracking-widest font-medium">
                When students submit reviews from their dashboard, they will appear here for moderation.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {reviews.map((r) => (
              <Card key={r._id} className="rounded-none border-border overflow-hidden group">
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row items-stretch">
                    <div className="p-8 flex-1 space-y-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          {r.student_photo ? (
                            <img src={r.student_photo} alt={r.student_name} className="w-14 h-14 rounded-none border border-border object-cover" />
                          ) : (
                            <div className="w-14 h-14 bg-primary/10 border border-primary/20 flex items-center justify-center">
                              <User className="w-6 h-6 text-primary" />
                            </div>
                          )}
                          <div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-foreground">
                              {r.student_name}
                            </h3>
                            <div className="flex items-center gap-3 mt-1">
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {(() => {
                                  try {
                                    const date = new Date(r.created_at);
                                    if (isNaN(date.getTime())) {
                                      // Handle case where it might be a MongoDB $date object
                                      const anyDate = r.created_at as any;
                                      if (anyDate?.$date) {
                                        const d = new Date(anyDate.$date);
                                        return isNaN(d.getTime()) ? "N/A" : format(d, "dd MMM yyyy");
                                      }
                                      return "N/A";
                                    }
                                    return format(date, "dd MMM yyyy");
                                  } catch (e) {
                                    return "N/A";
                                  }
                                })()}
                              </p>
                              <span className={cn(
                                "text-[9px] font-black px-2 py-0.5 uppercase tracking-tighter",
                                r.status === "approved" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" :
                                r.status === "pending" ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" :
                                "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                              )}>
                                {r.status}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={cn(
                                "w-4 h-4",
                                s <= r.rating ? "fill-accent text-accent" : "text-muted-foreground opacity-20"
                              )}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="relative">
                        <p className="text-sm font-bold text-foreground leading-relaxed italic pr-10">
                          "{r.comment}"
                        </p>
                      </div>
                    </div>

                    <div className="bg-muted/30 border-l border-border flex flex-col w-full md:w-48">
                      {r.status !== "approved" && (
                        <button
                          onClick={() => handleStatusUpdate(r._id, "approved")}
                          disabled={!!actionLoading}
                          className="flex-1 px-6 py-4 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-50 transition-colors border-b border-border disabled:opacity-50"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Approve
                        </button>
                      )}
                      {r.status !== "rejected" && (
                        <button
                          onClick={() => handleStatusUpdate(r._id, "rejected")}
                          disabled={!!actionLoading}
                          className="flex-1 px-6 py-4 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest text-amber-600 hover:bg-amber-50 transition-colors border-b border-border disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(r._id)}
                        disabled={!!actionLoading}
                        className="flex-1 px-6 py-4 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
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

export default AdminReviewPage;
