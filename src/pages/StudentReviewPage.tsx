import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, Send, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

const StudentReviewPage = () => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      toast.error("Please enter a comment");
      return;
    }

    if (comment.length > 300) {
      toast.error("Review must be 300 characters or less");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch("/api/reviews", {
        method: "POST",
        body: JSON.stringify({ rating, comment }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Review submitted successfully!");
        setComment("");
      } else {
        toast.error(data.message || "Failed to submit review");
      }
    } catch (error) {
      toast.error("An error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout role="Student">
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-primary" />
            Share Your Experience
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium uppercase tracking-wider">
            Your feedback helps us improve and inspires other students.
          </p>
        </div>

        <Card className="rounded-none border-border shadow-md overflow-hidden border-t-4 border-t-primary">
          <CardHeader className="bg-muted/30 border-b border-border">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em]">Submit Your Success Story</CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Rate Your Experience</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setRating(s)}
                      className="transition-transform active:scale-90"
                    >
                      <Star
                        className={cn(
                          "w-10 h-10 transition-colors",
                          s <= rating ? "fill-accent text-accent" : "text-muted-foreground opacity-30"
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Your Success Story / Feedback</label>
                  <span className={cn(
                    "text-[10px] font-bold uppercase",
                    comment.length > 250 ? "text-rose-500" : "text-muted-foreground"
                  )}>
                    {comment.length} / 300
                  </span>
                </div>
                <textarea
                  required
                  maxLength={300}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Tell us about your learning journey, how it helped your career, and your overall experience with the center..."
                  className="w-full min-h-[200px] px-4 py-4 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none transition-all resize-none leading-relaxed"
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-10 py-4 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3 hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Review
                    </>
                  )}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="bg-accent/5 border border-accent/20 p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-none bg-accent/10 flex items-center justify-center shrink-0">
            <Star className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-accent mb-1">Important Note</h4>
            <p className="text-xs font-bold text-muted-foreground leading-relaxed uppercase">
              All reviews are moderated by the administration before being displayed on the public website. Please ensure your feedback is professional and constructive.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentReviewPage;
