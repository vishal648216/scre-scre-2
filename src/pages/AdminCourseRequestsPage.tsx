import React, { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  BookOpen, 
  Building2, 
  Search, 
  Filter, 
  Check, 
  X, 
  AlertCircle,
  FileText,
  DollarSign,
  Calendar,
  Layers,
  ChevronDown,
  Sparkles,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AcademicBundleDetailModal } from "@/components/admin/AcademicBundleDetailModal";

interface CourseRequest {
  id: string;
  name: string;
  code: string;
  category?: string;
  type?: string;
  duration_months?: number;
  total_fee?: number;
  registration_fee?: number;
  description?: string;
  eligibility?: string;
  approval_status?: "pending" | "approved" | "rejected";
  status?: string;
  requested_by_center_id?: string;
  requested_by_center_name?: string;
  requested_at?: string;
  rejection_reason?: string;
  units_count?: number;
}

export default function AdminCourseRequestsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRequest, setSelectedRequest] = useState<CourseRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Fetch Course Requests from Backend
  const { data: coursesData = [], isLoading, refetch } = useQuery<CourseRequest[]>({
    queryKey: ["admin-course-requests"],
    queryFn: async () => {
      // Try dedicated endpoint or general courses filter
      const res = await apiFetch("/api/admin/courses/requests");
      if (res.ok) {
        const data = await res.json();
        const rawList = Array.isArray(data) ? data : data.courses || data.data || [];
        return rawList.map((item: any) => ({
          ...item,
          id: item.id || item._id || "",
          _id: item._id || item.id || "",
          name: item.name || item.course_name || "Untitled Course",
          code: item.code || item.course_code || "",
          requested_by_center_name: item.requested_by_center_name || item.created_by_center_name || "Franchise Partner",
        }));
      }
      
      // Fallback to fetch all courses and filter center-requested or pending ones
      const fallbackRes = await apiFetch("/api/courses?limit=100");
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        const list = Array.isArray(fallbackData) ? fallbackData : fallbackData.courses || fallbackData.data || [];
        return list.map((item: any) => ({
          ...item,
          id: item.id || item._id || "",
          _id: item._id || item.id || "",
          name: item.name || item.course_name || "Untitled Course",
          code: item.code || item.course_code || "",
          requested_by_center_name: item.requested_by_center_name || item.created_by_center_name || "Franchise Partner",
        }));
      }
      return [];
    }
  });

  // Approve Mutation
  const approveMutation = useMutation({
    mutationFn: async (courseId: string) => {
      if (!courseId) throw new Error("Invalid Course ID");
      const res = await apiFetch(`/api/admin/courses/${encodeURIComponent(courseId)}/approve`, {
        method: "POST",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let errMsg = "Failed to approve course request";
        try {
          const json = JSON.parse(text);
          if (json.message) errMsg = json.message;
        } catch {
          if (text) errMsg = text;
        }

        const altRes = await apiFetch(`/api/courses/${encodeURIComponent(courseId)}/approve`, {
          method: "POST",
        });
        if (!altRes.ok) {
          const patchRes = await apiFetch(`/api/courses/${encodeURIComponent(courseId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ approval_status: "approved", status: "active" }),
          });
          if (!patchRes.ok) {
            throw new Error(errMsg);
          }
          return patchRes.json().catch(() => ({ success: true }));
        }
        return altRes.json().catch(() => ({ success: true }));
      }
      return res.json().catch(() => ({ success: true }));
    },
    onSuccess: () => {
      toast.success("Course request approved successfully!");
      queryClient.invalidateQueries({ queryKey: ["admin-course-requests"] });
      queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
      setSelectedRequest(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to approve course");
    }
  });

  // Reject Mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ courseId, reason }: { courseId: string; reason: string }) => {
      if (!courseId) throw new Error("Invalid Course ID");
      const res = await apiFetch(`/api/admin/courses/${encodeURIComponent(courseId)}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejection_reason: reason, reason }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let errMsg = "Failed to reject course request";
        try {
          const json = JSON.parse(text);
          if (json.message) errMsg = json.message;
        } catch {
          if (text) errMsg = text;
        }

        const altRes = await apiFetch(`/api/courses/${encodeURIComponent(courseId)}/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rejection_reason: reason, reason }),
        });
        if (!altRes.ok) {
          const patchRes = await apiFetch(`/api/courses/${encodeURIComponent(courseId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ approval_status: "rejected", rejection_reason: reason }),
          });
          if (!patchRes.ok) {
            throw new Error(errMsg);
          }
          return patchRes.json().catch(() => ({ success: true }));
        }
        return altRes.json().catch(() => ({ success: true }));
      }
      return res.json().catch(() => ({ success: true }));
    },
    onSuccess: () => {
      toast.success("Course request rejected");
      queryClient.invalidateQueries({ queryKey: ["admin-course-requests"] });
      queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
      setIsRejectDialogOpen(false);
      setRejectionReason("");
      setSelectedRequest(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to reject course");
    }
  });

  // Helper function to resolve course status cleanly
  const getStatus = (course: CourseRequest): "pending" | "approved" | "rejected" => {
    if (course.approval_status === "approved" || course.approval_status === "rejected" || course.approval_status === "pending") {
      return course.approval_status;
    }
    if (course.status === "active") return "approved";
    if (course.status === "rejected") return "rejected";
    return "pending";
  };

  // Filtering
  const filteredCourses = coursesData.filter(course => {
    const matchesSearch = 
      (course.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (course.code || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (course.requested_by_center_name || "").toLowerCase().includes(searchTerm.toLowerCase());

    const status = getStatus(course);
    const matchesStatus = statusFilter === "all" || status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const pendingCount = coursesData.filter(c => getStatus(c) === "pending").length;
  const approvedCount = coursesData.filter(c => getStatus(c) === "approved").length;
  const rejectedCount = coursesData.filter(c => getStatus(c) === "rejected").length;

  const handleOpenReject = (course: CourseRequest) => {
    setSelectedRequest(course);
    setIsRejectDialogOpen(true);
  };

  const handleConfirmReject = () => {
    if (!selectedRequest) return;
    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    const targetId = selectedRequest.id || (selectedRequest as any)._id || "";
    rejectMutation.mutate({ courseId: targetId, reason: rejectionReason });
  };

  return (
    <DashboardLayout title="Center Course Requests & Approvals">
      <div className="space-y-6 pb-12">
        {/* Banner Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-600 via-indigo-600 to-purple-700 p-6 md:p-8 text-white shadow-xl">
          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold backdrop-blur-md">
              <Sparkles className="h-4 w-4 text-amber-300" />
              <span>Franchise Academic Management</span>
            </div>
            <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight">
              Course Approval Portal
            </h1>
            <p className="max-w-2xl text-amber-100 text-sm md:text-base font-medium">
              Review and approve custom course proposals submitted by regional franchise centers. Ensure academic standards and syllabus compliance.
            </p>
          </div>
          <div className="absolute -right-10 -bottom-10 h-64 w-64 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Requests</p>
                <h3 className="text-2xl font-bold text-foreground mt-1">{coursesData.length}</h3>
              </div>
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <BookOpen className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-amber-500/30 bg-amber-500/5 backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pending Review</p>
                <h3 className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">{pendingCount}</h3>
              </div>
              <div className="h-12 w-12 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center animate-pulse">
                <Clock className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Approved Courses</p>
                <h3 className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{approvedCount}</h3>
              </div>
              <div className="h-12 w-12 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-rose-500/30 bg-rose-500/5 backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Rejected</p>
                <h3 className="text-2xl font-bold text-rose-700 dark:text-rose-300 mt-1">{rejectedCount}</h3>
              </div>
              <div className="h-12 w-12 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <XCircle className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Toolbar & Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card/80 p-4 rounded-2xl border border-border/50 backdrop-blur-md">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search course name, code, center..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-xl bg-background/60"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl w-full sm:w-auto overflow-x-auto">
            {[
              { key: "all", label: "All" },
              { key: "pending", label: `Pending (${pendingCount})` },
              { key: "approved", label: "Approved" },
              { key: "rejected", label: "Rejected" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  statusFilter === tab.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Requests List */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-56 rounded-2xl bg-muted/40 animate-pulse border border-border/40" />
            ))}
          </div>
        ) : filteredCourses.length === 0 ? (
          <Card className="rounded-3xl border border-dashed border-border/60 p-12 text-center">
            <CardContent className="space-y-4 pt-6">
              <div className="mx-auto h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground">
                <BookOpen className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">No Course Requests Found</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
                  {searchTerm || statusFilter !== "all"
                    ? "No requests matching your search and filter criteria."
                    : "There are currently no center course approval requests in the pipeline."}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredCourses.map((course) => {
              const status = getStatus(course);

              return (
                <Card 
                  key={course.id} 
                  className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-md shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col justify-between overflow-hidden"
                >
                  <CardHeader className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="font-mono text-xs font-bold uppercase bg-primary/5 text-primary border-primary/20">
                            {course.code || "CRS-PROPOSAL"}
                          </Badge>
                          {course.type && (
                            <Badge variant="secondary" className="text-xs capitalize">
                              {course.type}
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-lg font-bold text-foreground leading-snug">
                          {course.name}
                        </CardTitle>
                      </div>

                      {/* Status Badge */}
                      {status === "pending" && (
                        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 flex items-center gap-1 px-3 py-1 font-semibold rounded-full">
                          <Clock className="h-3.5 w-3.5" />
                          Pending Review
                        </Badge>
                      )}
                      {status === "approved" && (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 flex items-center gap-1 px-3 py-1 font-semibold rounded-full">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approved
                        </Badge>
                      )}
                      {status === "rejected" && (
                        <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 flex items-center gap-1 px-3 py-1 font-semibold rounded-full">
                          <XCircle className="h-3.5 w-3.5" />
                          Rejected
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 pt-0 space-y-4">
                    {/* Center Info Banner */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/40 text-xs">
                      <div className="flex items-center gap-2 font-medium text-muted-foreground">
                        <Building2 className="h-4 w-4 text-primary" />
                        <span>Requested By: <strong className="text-foreground font-semibold">{course.requested_by_center_name || "Franchise Partner"}</strong></span>
                      </div>
                      {course.requested_at && (
                        <span className="text-muted-foreground font-mono">
                          {new Date(course.requested_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    {/* Course Metrics */}
                    <div className="grid grid-cols-3 gap-2 py-1 text-center bg-background/50 rounded-xl p-2.5 border border-border/30">
                      <div>
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground">Duration</p>
                        <p className="text-xs font-bold text-foreground mt-0.5">{course.duration_months ? `${course.duration_months} Months` : "Flexible"}</p>
                      </div>
                      <div className="border-x border-border/40 px-1">
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground">Total Fee</p>
                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">₹{(course.total_fee || course.fees || (course as any).total_fees || 0).toLocaleString("en-IN")}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground">Units/Modules</p>
                        <p className="text-xs font-bold text-foreground mt-0.5">{course.units_count || "Syllabus Defined"}</p>
                      </div>
                    </div>

                    {/* Description preview */}
                    {course.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 italic">
                        "{course.description}"
                      </p>
                    )}

                    {/* Rejection reason display if rejected */}
                    {status === "rejected" && course.rejection_reason && (
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300">
                        <strong>Reason for Rejection:</strong> {course.rejection_reason}
                      </div>
                    )}
                  </CardContent>

                  {/* Actions Footer */}
                  <div className="p-4 bg-muted/20 border-t border-border/40 flex items-center justify-between gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setSelectedRequest(course);
                        setIsDetailModalOpen(true);
                      }}
                      className="rounded-xl text-xs gap-1.5"
                    >
                      <Info className="h-3.5 w-3.5" />
                      View Details
                    </Button>

                    <div className="flex items-center gap-2">
                      {status === "pending" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenReject(course)}
                            disabled={rejectMutation.isPending || approveMutation.isPending}
                            className="rounded-xl border-rose-500/40 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs gap-1"
                          >
                            <X className="h-3.5 w-3.5" />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => approveMutation.mutate(course.id || (course as any)._id)}
                            disabled={approveMutation.isPending || rejectMutation.isPending}
                            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1 shadow-sm"
                          >
                            <Check className="h-3.5 w-3.5" />
                            {approveMutation.isPending ? "Approving..." : "Approve Course"}
                          </Button>
                        </>
                      )}
                      {status === "approved" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled
                          className="rounded-xl text-emerald-600 dark:text-emerald-400 font-semibold text-xs gap-1"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Approved
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Reject Dialog */}
        <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-rose-600">
                <AlertCircle className="h-5 w-5" />
                Reject Course Proposal
              </DialogTitle>
              <DialogDescription>
                Provide feedback to the franchise center regarding why this course proposal cannot be approved at this time.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Course Name</p>
                <p className="text-sm font-bold text-foreground">{selectedRequest?.name}</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Reason for Rejection *</label>
                <Textarea
                  placeholder="e.g. Syllabus lacks practical modules, fee structure does not meet university guidelines..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="rounded-xl min-h-[100px]"
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleConfirmReject} 
                disabled={rejectMutation.isPending}
                className="rounded-xl gap-1.5"
              >
                <X className="h-4 w-4" />
                {rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Full Academic Bundle Details Modal */}
        <AcademicBundleDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          course={selectedRequest}
          isSuperAdmin={true}
          isActionPending={approveMutation.isPending || rejectMutation.isPending}
          onApprove={(cId) => {
            setIsDetailModalOpen(false);
            approveMutation.mutate(cId);
          }}
          onReject={(c) => {
            setIsDetailModalOpen(false);
            handleOpenReject(c);
          }}
        />
      </div>
    </DashboardLayout>
  );
}
