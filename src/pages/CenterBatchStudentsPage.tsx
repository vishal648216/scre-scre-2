import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  Users,
  Plus,
  Search,
  CheckCircle2,
  UserMinus,
  ArrowLeftRight,
} from "lucide-react";

interface Batch {
  _id?: any;
  id?: any;
  name: string;
  session_id?: any;
  course_id?: any;
  max_capacity: number;
  current_count: number;
}

interface Student {
  id: string;
  username: string;
  full_name?: string;
  email?: string;
  phone?: string;
  center_id?: string;
  session_id?: string;
  course_id?: string;
}

interface LinkRow {
  _id?: any;
  id?: any;
  student_id: string;
  batch_id: string;
  status: string;
}

const toId = (v: any): string => {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v.$oid) return v.$oid;
  return "";
};

const CenterBatchStudentsPage = () => {
  const { batch_id } = useParams<{ batch_id: string }>();

  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  const [batch, setBatch] = useState<Batch | null>(null);
  const [allBatches, setAllBatches] = useState<Batch[]>([]);

  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [unassigned, setUnassigned] = useState<Student[]>([]);
  const [assignedLinks, setAssignedLinks] = useState<LinkRow[]>([]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchUnassigned, setSearchUnassigned] = useState("");
  const [searchAssigned, setSearchAssigned] = useState("");

  // Reassign (edit batch) dialog state
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignStudent, setReassignStudent] = useState<Student | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState("");
  const [reassignSaving, setReassignSaving] = useState(false);

  const fetchData = async () => {
    if (!batch_id) return;
    setLoading(true);
    try {
      const [batchesRes, unassignedRes, assignedRes, studentsRes] = await Promise.all([
        apiFetch("/api/batches"),
        apiFetch("/api/batch-students/unassigned"),
        apiFetch(`/api/batch-students/batch/${batch_id}`),
        apiFetch("/api/students"),
      ]);

      if (batchesRes.ok) {
        const data = await batchesRes.json();
        const normalized: Batch[] = (Array.isArray(data) ? data : []).map((b: any) => ({
          _id: toId(b._id || b.id),
          name: b.name ?? "",
          session_id: toId(b.session_id),
          course_id: toId(b.course_id),
          max_capacity: Number(b.max_capacity ?? 0),
          current_count: Number(b.current_count ?? 0),
        }));
        setAllBatches(normalized);

        const found = normalized.find((b) => b._id === batch_id);
        setBatch(found || null);
      }

      let unassignedRows: Student[] = [];
      if (unassignedRes.ok) {
        const data = await unassignedRes.json();
        unassignedRows = (Array.isArray(data) ? data : []).map((s: any) => ({
          id: toId(s.id || s._id),
          username: s.username ?? "",
          full_name: s.full_name,
          email: s.email,
          phone: s.phone,
          center_id: toId(s.center_id),
          session_id: toId(s.session_id),
          course_id: toId(s.course_id),
        }));
      }
      setUnassigned(unassignedRows);

      if (assignedRes.ok) {
        const data = await assignedRes.json();
        const links = (Array.isArray(data) ? data : []).map((r: any) => ({
          _id: toId(r._id || r.id),
          id: toId(r.id || r._id),
          student_id: toId(r.student_id),
          batch_id: toId(r.batch_id),
          status: r.status || "active",
        }));
        setAssignedLinks(links);
      } else {
        setAssignedLinks([]);
      }

      if (studentsRes.ok) {
        const data = await studentsRes.json();
        const rows = (Array.isArray(data) ? data : []).map((u: any) => ({
          id: toId(u._id || u.id),
          username: u.username ?? "",
          full_name: u.full_name,
          email: u.email,
          phone: u.phone,
          center_id: toId(u.parent_id),
          session_id: toId(u.session_id),
          course_id: toId(u.course_id),
        }));
        setAllStudents(rows);
      } else {
        setAllStudents([]);
      }
    } catch {
      toast.error("Failed to load batch students data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [batch_id]);

  const assignedStudents = useMemo(() => {
    const mapById = new Map(allStudents.map((s) => [s.id, s]));
    const q = searchAssigned.trim().toLowerCase();
    const rows = assignedLinks
      .map((l) => mapById.get(l.student_id))
      .filter(Boolean) as Student[];

    if (!q) return rows;
    return rows.filter((s) =>
      `${s.full_name || ""} ${s.username} ${s.email || ""} ${s.phone || ""}`.toLowerCase().includes(q)
    );
  }, [assignedLinks, allStudents, searchAssigned]);

  const eligibleStudents = useMemo(() => {
    const q = searchUnassigned.trim().toLowerCase();

    return unassigned.filter((s) => {
      const sessionOk = batch?.session_id ? s.session_id === batch.session_id : true;
      const courseOk = batch?.course_id ? s.course_id === batch.course_id : true;
      if (!sessionOk || !courseOk) return false;
      if (!q) return true;
      return `${s.full_name || ""} ${s.username} ${s.email || ""} ${s.phone || ""}`.toLowerCase().includes(q);
    });
  }, [unassigned, batch, searchUnassigned]);

  // Other batches a student can be moved into: same session + course, not the current batch, has room
  const reassignOptions = useMemo(() => {
    if (!reassignStudent) return [];
    return allBatches.filter((b) => {
      if (b._id === batch_id) return false;
      const sessionOk = reassignStudent.session_id ? b.session_id === reassignStudent.session_id : true;
      const courseOk = reassignStudent.course_id ? b.course_id === reassignStudent.course_id : true;
      const hasRoom = b.current_count < b.max_capacity;
      return sessionOk && courseOk && hasRoom;
    });
  }, [allBatches, reassignStudent, batch_id]);

  const toggleSelect = (studentId: string) => {
    const next = new Set(selected);
    if (next.has(studentId)) next.delete(studentId);
    else next.add(studentId);
    setSelected(next);
  };

  const selectAllVisible = () => {
    const next = new Set(selected);
    eligibleStudents.forEach((s) => next.add(s.id));
    setSelected(next);
  };

  const clearSelection = () => setSelected(new Set());

  const bulkAssign = async () => {
    if (!batch_id) return;
    if (selected.size === 0) return toast.error("Select at least one student");

    setAssigning(true);
    try {
      const ids = Array.from(selected);
      for (const student_id of ids) {
        const res = await apiFetch("/api/batch-students/assign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ student_id, batch_id }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.message || `Failed for student ${student_id}`);
        }
      }
      toast.success(`Assigned ${ids.length} student(s) successfully`);
      setSelected(new Set());
      fetchData();
    } catch (e: any) {
      toast.error(e?.message || "Bulk assign failed");
    } finally {
      setAssigning(false);
    }
  };

  const unassignStudent = async (student_id: string) => {
    const next = new Set(removingIds);
    next.add(student_id);
    setRemovingIds(next);

    try {
      const res = await apiFetch("/api/batch-students/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id, batch_id: null }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to unassign");
      }

      toast.success("Student removed from batch");
      fetchData();
    } catch (e: any) {
      toast.error(e?.message || "Unassign failed");
    } finally {
      const done = new Set(removingIds);
      done.delete(student_id);
      setRemovingIds(done);
    }
  };

  const openReassign = (student: Student) => {
    setReassignStudent(student);
    setReassignTargetId("");
    setReassignOpen(true);
  };

  const closeReassign = () => {
    setReassignOpen(false);
    setReassignStudent(null);
    setReassignTargetId("");
  };

  const submitReassign = async () => {
    if (!reassignStudent) return;
    if (!reassignTargetId) {
      toast.error("Select a batch to move the student into");
      return;
    }

    setReassignSaving(true);
    try {
      const res = await apiFetch("/api/batch-students/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: reassignStudent.id,
          batch_id: reassignTargetId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to update student's batch");
      }

      toast.success("Student's batch updated");
      closeReassign();
      fetchData();
    } catch (e: any) {
      toast.error(e?.message || "Batch update failed");
    } finally {
      setReassignSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading font-extrabold text-3xl uppercase tracking-tight">Center Batch Students</h1>
          <p className="text-sm text-muted-foreground">Batch ID: <span className="font-mono">{batch_id}</span></p>
          {batch ? <p className="text-xs text-muted-foreground">Batch: <b>{batch.name}</b> • Capacity {batch.current_count}/{batch.max_capacity}</p> : null}
        </div>

        {loading ? (
          <div className="py-20 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* TOP: Assigned students */}
            <Card className="rounded-none border-border">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Current Batch Students ({assignedStudents.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchAssigned}
                    onChange={(e) => setSearchAssigned(e.target.value)}
                    placeholder="Search assigned student..."
                    className="pl-10 rounded-none"
                  />
                </div>

                {assignedStudents.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground border border-dashed">No students assigned in this batch yet.</div>
                ) : (
                  <div className="border border-border">
                    <div className="grid grid-cols-12 bg-muted/30 border-b px-3 py-2 text-[10px] font-black uppercase tracking-widest">
                      <div className="col-span-4">Name</div>
                      <div className="col-span-3">Username</div>
                      <div className="col-span-2">Email / Phone</div>
                      <div className="col-span-3 text-right">Action</div>
                    </div>

                    <div className="divide-y">
                      {assignedStudents.map((s) => (
                        <div key={s.id} className="grid grid-cols-12 items-center px-3 py-3 text-sm">
                          <div className="col-span-4 font-semibold">{s.full_name || "-"}</div>
                          <div className="col-span-3 font-mono text-xs">{s.username}</div>
                          <div className="col-span-2 text-xs text-muted-foreground">{s.email || "-"} {s.phone ? `• ${s.phone}` : ""}</div>
                          <div className="col-span-3 flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-none h-7 text-[10px]"
                              onClick={() => openReassign(s)}
                            >
                              <ArrowLeftRight className="w-3 h-3 mr-1" />
                              Move Batch
                            </Button>
                            {/* <Button
                              size="sm"
                              variant="outline"
                              className="rounded-none h-7 text-[10px]"
                              disabled={removingIds.has(s.id)}
                              onClick={() => unassignStudent(s.id)}
                            >
                              {removingIds.has(s.id) ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <UserMinus className="w-3 h-3 mr-1" />}
                              Remove
                            </Button> */}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* BOTTOM: Unassigned eligible students */}
            <Card className="rounded-none border-border">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Unassigned Eligible Students ({eligibleStudents.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchUnassigned}
                      onChange={(e) => setSearchUnassigned(e.target.value)}
                      placeholder="Search student..."
                      className="pl-10 rounded-none"
                    />
                  </div>

                  <Button variant="outline" onClick={selectAllVisible} className="rounded-none">Select Visible</Button>
                  <Button variant="outline" onClick={clearSelection} className="rounded-none">Clear</Button>
                  <Button onClick={bulkAssign} disabled={assigning || selected.size === 0} className="rounded-none">
                    {assigning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    Bulk Assign ({selected.size})
                  </Button>
                </div>

                {eligibleStudents.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground border border-dashed">No eligible unassigned students found.</div>
                ) : (
                  <div className="border border-border">
                    <div className="grid grid-cols-12 bg-muted/30 border-b px-3 py-2 text-[10px] font-black uppercase tracking-widest">
                      <div className="col-span-1">Select</div>
                      <div className="col-span-4">Name</div>
                      <div className="col-span-3">Username</div>
                      <div className="col-span-4">Email / Phone</div>
                    </div>

                    <div className="divide-y">
                      {eligibleStudents.map((s) => {
                        const checked = selected.has(s.id);
                        return (
                          <div key={s.id} className="grid grid-cols-12 items-center px-3 py-3 text-sm">
                            <div className="col-span-1">
                              <input type="checkbox" checked={checked} onChange={() => toggleSelect(s.id)} className="h-4 w-4" />
                            </div>
                            <div className="col-span-4 font-semibold flex items-center gap-2">
                              {checked ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : null}
                              {s.full_name || "-"}
                            </div>
                            <div className="col-span-3 font-mono text-xs">{s.username}</div>
                            <div className="col-span-4 text-xs text-muted-foreground">
                              {s.email || "-"} {s.phone ? `• ${s.phone}` : ""}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Reassign / edit student's batch dialog */}
      <Dialog open={reassignOpen} onOpenChange={(open) => (open ? setReassignOpen(true) : closeReassign())}>
        <DialogContent className="rounded-none border-border max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-6 bg-muted/30 border-b border-border">
            <DialogTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-primary" />
              Move Student to Another Batch
            </DialogTitle>
          </DialogHeader>

          <div className="p-6 space-y-4">
            <p className="text-sm">
              Moving <b>{reassignStudent?.full_name || reassignStudent?.username}</b> out of{" "}
              <b>{batch?.name}</b>.
            </p>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Select Target Batch
              </label>
              <select
                value={reassignTargetId}
                onChange={(e) => setReassignTargetId(e.target.value)}
                className="w-full h-12 border border-border bg-background px-4 text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-primary appearance-none transition-all hover:border-primary/50"
              >
                <option value="">Choose Batch</option>
                {reassignOptions.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name} ({b.current_count}/{b.max_capacity})
                  </option>
                ))}
              </select>
              {reassignOptions.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">
                  No other eligible batches with open seats found for this student's session/course.
                </p>
              ) : null}
            </div>
          </div>

          <DialogFooter className="p-6 bg-muted/30 border-t border-border gap-3">
            <Button
              variant="outline"
              onClick={closeReassign}
              className="rounded-none border-border text-[10px] font-black uppercase tracking-widest h-11 px-6 hover:bg-background"
            >
              Cancel
            </Button>
            <Button
              onClick={submitReassign}
              disabled={reassignSaving || !reassignTargetId}
              className="rounded-none text-[10px] font-black uppercase tracking-widest h-11 px-8 shadow-lg shadow-primary/20"
            >
              {reassignSaving ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
              Confirm Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default CenterBatchStudentsPage;