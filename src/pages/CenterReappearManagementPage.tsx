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
import { Loader2, Users, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [allowReappear, setAllowReappear] = useState(false);
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
          body: JSON.stringify({ allow_reappear: allowReappear }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        toast.success("Reappear permission saved");
        setSelected(null);
        fetchData();
      } else {
        toast.error(data.message || "Failed to save");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Reappear Management</h1>
            <p className="text-sm text-muted-foreground">Students who failed overall course result</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs font-bold uppercase">Category</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {categories.map((c: any) => (
                    <SelectItem key={c.id || c._id} value={c.id || c._id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold uppercase">Course</Label>
              <Select value={filterCourse} onValueChange={setFilterCourse}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {filteredCourses.map((c: any) => (
                    <SelectItem key={c.id || c._id} value={c.id || c._id}>{c.course_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-xs font-bold uppercase">Search</Label>
                <Input
                  placeholder="Enrollment No or Serial No"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchData()}
                />
              </div>
              <Button onClick={fetchData} variant="outline"><Search className="w-4 h-4" /></Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-bold uppercase">Failed Students</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-3 font-bold">S.No</th>
                    <th className="text-left p-3 font-bold">Enrollment No</th>
                    <th className="text-left p-3 font-bold">Student Name</th>
                    <th className="text-left p-3 font-bold">Course</th>
                    <th className="text-left p-3 font-bold">Attempt</th>
                    <th className="text-left p-3 font-bold">Status</th>
                    <th className="text-left p-3 font-bold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={`${row.student_id}-${row.course_id}`} className="border-b">
                      <td className="p-3">{row.serial_number || i + 1}</td>
                      <td className="p-3">{row.enrollment_number || "—"}</td>
                      <td className="p-3 font-medium">{row.name}</td>
                      <td className="p-3">{row.course_name}</td>
                      <td className="p-3">{row.current_attempt}</td>
                      <td className="p-3">{row.status}</td>
                      <td className="p-3">
                        {row.can_manage ? (
                          <Button size="sm" onClick={() => openManage(row, false)}>Manage</Button>
                        ) : row.can_view ? (
                          <Button size="sm" variant="outline" onClick={() => openManage(row, true)}>View</Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No failed students found</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {viewOnly ? "View Attempts" : "Reappear Management"} — {selected?.name}
              </DialogTitle>
            </DialogHeader>
            {selected && (
              <div className="space-y-4">
                {selected.attempts.map((a) => (
                  <div key={a.attempt_number} className="border p-3 rounded-lg space-y-2">
                    <p className="font-bold text-sm">
                      Attempt {a.attempt_number}
                      {a.is_current && <span className="ml-2 text-xs text-primary">(current)</span>}
                    </p>
                    <div className="flex items-center gap-2 text-sm">
                      <Checkbox checked={a.attempt_number === 1 ? true : a.appeared} disabled />
                      <span>Appeared</span>
                    </div>
                    {a.is_current && !viewOnly ? (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={allowReappear}
                          onCheckedChange={(v) => setAllowReappear(v === true)}
                        />
                        <span className="text-sm font-medium">Allow Reappearing</span>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Result: {a.overall_result || "pending"} • Reappear: {a.allow_reappear ? "Yes" : "No"}
                        {a.marks_submitted ? " • Marks submitted" : " • Marks open"}
                      </p>
                    )}
                  </div>
                ))}
                {!viewOnly && selected.can_manage && (
                  <Button onClick={handleSubmit} disabled={submitting} className="w-full">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit"}
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
