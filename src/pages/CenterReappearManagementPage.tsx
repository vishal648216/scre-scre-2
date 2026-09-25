import { useEffect, useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Users, Search, AlertTriangle, CheckCircle2, RotateCcw, Filter, User, BookOpen, ShieldAlert, IndianRupee, Layers } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AttemptView {
  attempt_number: number;
  appeared: boolean;
  allow_reappear: boolean;
  reappear_locked: boolean;
  overall_result?: string;
  marks_submitted: boolean;
  is_current: boolean;
  is_editable: boolean;
}

interface ReappearRow {
  student_id: string;
  serial_number?: string;
  enrollment_number?: string;
  name: string;
  course_id: string;
  course_name: string;
  current_attempt: number;
  status: string;
  can_manage: boolean;
  can_view: boolean;
  attempts: AttemptView[];
}

const CenterReappearManagementPage = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ReappearRow[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterCourse, setFilterCourse] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ReappearRow | null>(null);
  const [viewOnly, setViewOnly] = useState(false);
  const [allowReappear, setAllowReappear] = useState<boolean>(false);
  const [reappearFee, setReappearFee] = useState<number>(500);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCategory !== "all") params.set("category_id", filterCategory);
      if (filterCourse !== "all") params.set("course_id", filterCourse);
      if (search.trim()) params.set("search", search.trim());

      const [rowsRes, catRes, courseRes] = await Promise.all([
        apiFetch(`/api/exam/reappear/students?${params}`),
        apiFetch("/api/admin/categories?limit=100"),
        apiFetch("/api/courses/allot"),
      ]);

      if (rowsRes.ok) setRows(await rowsRes.json());
      if (catRes.ok) {
        const c = await catRes.json();
        setCategories(c.items || c || []);
      }
      if (courseRes.ok) setCourses(await courseRes.json());
    } catch (e) {
      console.error(e);
      toast.error("Failed to load reappear records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterCategory, filterCourse]);

  const filteredCourses = useMemo(() => {
    if (filterCategory === "all") return courses;
    return courses.filter((c: any) => (c.category_id || c.categoryId) === filterCategory);
  }, [courses, filterCategory]);

  const openManage = (row: ReappearRow, view = false) => {
    setSelected(row);
    setViewOnly(view);
    const current = row.attempts.find((a) => a.is_current);
    setAllowReappear(current?.allow_reappear || false);
    setReappearFee(500);
  };

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(
        `/api/exam/reappear/${selected.student_id}/${selected.course_id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ allow_reappear: allowReappear, reappear_fee: reappearFee }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        toast.success("Reappear permission and backlog fee saved successfully!");
        setSelected(null);
        fetchData();
      } else {
        toast.error(data.message || "Failed to save");
      }
    } catch {
      toast.error("Error saving reappear settings");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header Card */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                Reappear & Backlog Management
              </h1>
              <p className="text-xs font-semibold text-slate-400 mt-1">
                Manage failed candidates, grant re-examination permissions, and configure backlog fees
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-mono font-bold text-slate-300">Total Backlog Candidates: {rows.length}</span>
          </div>
        </div>

        {/* Filter Section */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl backdrop-blur-xl grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 block">Category Filter</Label>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="bg-slate-950 border-slate-800 text-xs text-white rounded-xl h-10">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white">
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c: any) => (
                  <SelectItem key={c.id || c._id} value={c.id || c._id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 block">Course Filter</Label>
            <Select value={filterCourse} onValueChange={setFilterCourse}>
              <SelectTrigger className="bg-slate-950 border-slate-800 text-xs text-white rounded-xl h-10">
                <SelectValue placeholder="All Courses" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white">
                <SelectItem value="all">All Courses</SelectItem>
                {filteredCourses.map((c: any) => (
                  <SelectItem key={c.id || c._id} value={c.id || c._id}>{c.course_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2 flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 block">Search Candidate</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Enter Student Name, Roll No or Enrollment No..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchData()}
                  className="pl-10 bg-slate-950 border-slate-800 text-xs text-white rounded-xl h-10 placeholder:text-slate-500"
                />
              </div>
            </div>
            <Button onClick={fetchData} className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl h-10 px-5 font-bold text-xs flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filter
            </Button>
          </div>
        </div>

        {/* Failed Students Roster Table */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-xl overflow-hidden">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Failed / Reappear Eligible Candidates List
            </h3>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                    <th className="p-4 text-left">S.No</th>
                    <th className="p-4 text-left">Enrollment No</th>
                    <th className="p-4 text-left">Candidate Name</th>
                    <th className="p-4 text-left">Course Title</th>
                    <th className="p-4 text-center">Attempt #</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-medium">
                  {rows.map((row, i) => (
                    <tr key={`${row.student_id}-${row.course_id}`} className="hover:bg-slate-800/30 transition-colors text-slate-200">
                      <td className="p-4 font-mono font-bold text-slate-400">{row.serial_number || i + 1}</td>
                      <td className="p-4 font-mono font-bold text-blue-400">{row.enrollment_number || "N/A"}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-xs">
                            {row.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-extrabold text-white">{row.name}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                          <span>{row.course_name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 font-mono text-[10px]">
                          Attempt {row.current_attempt}
                        </Badge>
                      </td>
                      <td className="p-4 text-center">
                        <Badge className={cn(
                          "font-bold text-[10px] uppercase tracking-wider px-2.5 py-0.5 border",
                          row.status.toLowerCase().includes("fail") ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        )}>
                          {row.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        {row.can_manage ? (
                          <Button size="sm" onClick={() => openManage(row, false)} className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs h-8 px-3">
                            Manage Reappear
                          </Button>
                        ) : row.can_view ? (
                          <Button size="sm" variant="outline" onClick={() => openManage(row, true)} className="rounded-xl border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 font-bold text-xs h-8 px-3">
                            View History
                          </Button>
                        ) : (
                          <span className="text-slate-500 font-mono text-[10px]">No Action</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-12 text-center">
                        <div className="space-y-2">
                          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto opacity-80" />
                          <p className="text-slate-200 font-bold text-sm">No Reappear Candidates Found</p>
                          <p className="text-xs text-slate-500 max-w-sm mx-auto">All candidates have passed their examination attempts cleanly!</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Manage Reappear Modal */}
        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="max-w-lg bg-slate-950 border border-slate-800 text-slate-100 rounded-2xl p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-blue-400" />
                {viewOnly ? "Attempt History" : "Reappear Permission Manager"}
              </DialogTitle>
            </DialogHeader>

            {selected && (
              <div className="space-y-5 pt-2">
                <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                  <p className="text-xs font-bold text-white">{selected.name}</p>
                  <p className="text-[11px] font-mono text-slate-400">Course: {selected.course_name}</p>
                  <p className="text-[11px] font-mono text-blue-400">Enrollment: {selected.enrollment_number || "N/A"}</p>
                </div>

                <div className="space-y-3">
                  {selected.attempts.map((a) => (
                    <div key={a.attempt_number} className="border border-slate-800 bg-slate-900/60 p-4 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="font-black text-xs text-white flex items-center gap-2">
                          Attempt #{a.attempt_number}
                          {a.is_current && <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px]">Current</Badge>}
                        </p>
                        <span className="text-[10px] font-mono font-bold text-slate-400">
                          Result: {a.overall_result || "Failed / Backlog"}
                        </span>
                      </div>

                      {a.is_current && !viewOnly ? (
                        <div className="space-y-4 pt-2 border-t border-slate-800/80">
                          <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                            <Checkbox
                              id="reappear-chk"
                              checked={allowReappear}
                              onCheckedChange={(v) => setAllowReappear(v === true)}
                              className="border-slate-600 data-[state=checked]:bg-blue-600"
                            />
                            <label htmlFor="reappear-chk" className="text-xs font-bold text-slate-200 cursor-pointer">
                              Grant Reappear Exam Permission (Backlog)
                            </label>
                          </div>

                          {allowReappear && (
                            <div className="space-y-2 p-3.5 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                              <Label className="text-[10px] font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                                <IndianRupee className="w-3.5 h-3.5" />
                                Backlog Re-examination Fee (₹)
                              </Label>
                              <Input
                                type="number"
                                value={reappearFee}
                                onChange={(e) => setReappearFee(parseFloat(e.target.value) || 0)}
                                placeholder="e.g. 500"
                                className="bg-slate-950 border-slate-800 text-xs text-white rounded-xl h-10 font-mono font-bold"
                              />
                              <p className="text-[10px] text-slate-400">
                                Student will be prompted to complete fee payment before attempting the backlog examination.
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">
                          Status: {a.allow_reappear ? "Reappear Permitted" : "No Reappear Permission"} • Marks Submitted: {a.marks_submitted ? "Yes" : "No"}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {!viewOnly && selected.can_manage && (
                  <Button onClick={handleSubmit} disabled={submitting} className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs h-10 shadow-lg shadow-blue-500/20">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Save Reappear Settings & Backlog Fee
                  </Button>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default CenterReappearManagementPage;
