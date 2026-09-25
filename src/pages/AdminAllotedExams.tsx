import React, { useState, useEffect, useCallback, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { useNavigate, useLocation } from 'react-router-dom';
import { Pencil, Trash2, Plus, Calendar, Clock, BookOpen, FileText, CalendarClock, AlertCircle, Ticket } from 'lucide-react';
import { formatISTDate, formatISTTime } from '@/lib/time';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

interface SubjectConfigSnapshot {
  duration_minutes?: number;
  final_subject_total_marks?: number;
}
interface BlueprintSnapshot {
  name?: string;
  max_attempts?: number;
  blueprint_total_marks?: number;
  blueprint_duration_minutes?: number;
}

interface StudentPaper {
  _id: string;
  blueprint_id: string;
  student_id: string;
  center_id: string;
  status: string;
  start_window: string | null;
  end_window: string | null;
  start_time: string | null;
  submit_time: string | null;
  attempt_number: number;
  subject_id: string | null;
  subject_name?: string | null;
  created_at: string;
  subject_config_snapshot?: SubjectConfigSnapshot | null;
  blueprint_snapshot?: BlueprintSnapshot | null;
}

interface Blueprint {
  _id: string;
  name: string;
  course_id: string;
  duration_minutes?: number;
  total_marks?: number;
  max_attempts?: number;
}

interface Course {
  _id: string;
  course_name: string;
  category_id?: string;
}

interface Category {
  _id: string;
  name: string;
}

interface Subject {
  _id: string;
  course_id: string;
}

const toId = (v: unknown): string => {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('$oid' in o) return String(o.$oid);
    if ('oid' in o) return String(o.oid);
  }
  return v ? String(v) : '';
};

const toIso = (v: unknown): string => {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('$date' in o) {
      const d = o.$date;
      if (typeof d === 'number') return new Date(d).toISOString();
      if (typeof d === 'string') return d;
      if (d && typeof d === 'object' && '$numberLong' in (d as Record<string, unknown>)) {
        return new Date(parseInt(String((d as Record<string, unknown>).$numberLong))).toISOString();
      }
    }
  }
  return v ? String(v) : '';
};

interface SubjectBatchInfo {
  subjectId: string | null;
  subjectName: string;
  startWindow: string | null;
  endWindow: string | null;
  durationMinutes: number | null;
  totalMarks: number | null;
  examDate: string;
  examTime: string;
}

interface AllotmentBatch {
  id: string;
  courseId: string;
  papers: StudentPaper[];
  subjectCount: number;
  examDate: string;
  examTime: string;
  isActive: boolean;
  allotmentDate: string;
  subjects: SubjectBatchInfo[];
  blueprintName?: string;
}

const BATCH_GAP_MS = 2 * 60 * 60 * 1000; // 2 hours — papers created within one allotment run

const formatExamDate = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(iso));

const formatExamTime = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(new Date(iso));

const AdminAllotedExams: React.FC = () => {
  const [papers, setPapers] = useState<StudentPaper[]>([]);
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterCourse, setFilterCourse] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [postponeBatch, setPostponeBatch] = useState<AllotmentBatch | null>(null);
  const [postponeDays, setPostponeDays] = useState<number>(2);
  const [postponeMode, setPostponeMode] = useState<'days' | 'custom'>('days');
  const [postponeCustomDate, setPostponeCustomDate] = useState<string>('');
  const [postponeReason, setPostponeReason] = useState<string>('');
  const [postponing, setPostponing] = useState(false);
  const [purging, setPurging] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handlePurgeFakeData = async () => {
    if (!window.confirm("Are you sure you want to purge all test/fake exam papers and allotment batches? This cannot be undone.")) return;
    setPurging(true);
    try {
      const res = await apiFetch('/api/exam/purge-test-data', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Test exam data purged successfully!");
        fetchData();
      } else {
        toast.error(data.message || "Failed to purge test exam data");
      }
    } catch {
      toast.error("Error purging test exam data");
    } finally {
      setPurging(false);
    }
  };

  const handlePostponeSubmit = async () => {
    if (!postponeBatch) return;
    setPostponing(true);
    try {
      const payload: Record<string, unknown> = {
        paper_ids: postponeBatch.papers.map((p) => p._id),
        blueprint_id: postponeBatch.papers[0]?.blueprint_id,
        reason: postponeReason.trim() || undefined,
      };

      if (postponeMode === 'custom') {
        if (!postponeCustomDate) {
          toast.error('Please choose a valid new date and time');
          setPostponing(false);
          return;
        }
        payload.new_date = new Date(postponeCustomDate).toISOString();
      } else {
        payload.days = postponeDays;
      }

      const res = await apiFetch('/api/exam/postpone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.message || 'Failed to postpone exam');
      }

      toast.success(data?.message || `Exam successfully postponed!`);
      setPostponeBatch(null);
      setPostponeCustomDate('');
      setPostponeReason('');
      await fetchData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to postpone exam');
    } finally {
      setPostponing(false);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [papersRes, blueprintsRes, coursesRes, categoriesRes, subjectsRes] = await Promise.all([
        apiFetch('/api/exam/papers'),
        apiFetch('/api/exam/blueprints'),
        apiFetch('/api/courses'),
        apiFetch('/api/admin/categories?limit=100'),
        apiFetch('/api/admin/subjects'),
      ]);

      if (papersRes.ok) {
        const data = await papersRes.json();
        const raw = Array.isArray(data) ? data : [];
        setPapers(
          raw.map((p: Record<string, unknown>) => ({
            ...p,
            _id: toId(p._id),
            blueprint_id: toId(p.blueprint_id),
            student_id: toId(p.student_id),
            center_id: toId(p.center_id),
            subject_id: p.subject_id ? toId(p.subject_id) : null,
            subject_name: (p.subject_name as string) || null,
            start_window: p.start_window ? toIso(p.start_window) : null,
            end_window: p.end_window ? toIso(p.end_window) : null,
            start_time: p.start_time ? toIso(p.start_time) : null,
            submit_time: p.submit_time ? toIso(p.submit_time) : null,
            created_at: toIso(p.created_at),
            subject_config_snapshot: (p.subject_config_snapshot as SubjectConfigSnapshot) || null,
            blueprint_snapshot: (p.blueprint_snapshot as BlueprintSnapshot) || null,
          })) as StudentPaper[]
        );
      }
      if (blueprintsRes.ok) {
        const data = await blueprintsRes.json();
        const raw = Array.isArray(data) ? data : [];
        setBlueprints(
          raw.map((b: Record<string, unknown>) => ({
            ...b,
            _id: toId(b._id),
            course_id: toId(b.course_id),
            duration_minutes: typeof b.duration_minutes === 'number' ? b.duration_minutes : undefined,
            total_marks: typeof b.total_marks === 'number' ? b.total_marks : undefined,
            max_attempts: typeof b.max_attempts === 'number' ? b.max_attempts : undefined,
          })) as Blueprint[]
        );
      }
      if (coursesRes.ok) {
        const data = await coursesRes.json();
        const raw = Array.isArray(data) ? data : [];
        setCourses(
          raw.map((c: Record<string, unknown>) => ({
            ...c,
            _id: toId(c._id || c.id),
            category_id: c.category_id ? toId(c.category_id) : undefined,
          })) as Course[]
        );
      }
      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        const items = Array.isArray(data) ? data : (data.items || []);
        setCategories(
          items.map((cat: Record<string, unknown>) => ({
            ...cat,
            _id: toId(cat._id || cat.id),
          })) as Category[]
        );
      }
      if (subjectsRes.ok) {
        const data = await subjectsRes.json();
        const items = Array.isArray(data) ? data : (data.items || []);
        setSubjects(
          items.map((s: Record<string, unknown>) => ({
            ...s,
            _id: toId(s._id || s.id),
            course_id: toId(s.course_id),
          })) as Subject[]
        );
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, location.key]);

  const getCourseIdFromBlueprint = useCallback(
    (blueprintId: string) => {
      const id = toId(blueprintId);
      return blueprints.find((b) => b._id === id)?.course_id || '';
    },
    [blueprints]
  );

  const getCourseIdForPaper = useCallback(
    (paper: StudentPaper) => {
      const fromBlueprint = getCourseIdFromBlueprint(paper.blueprint_id);
      if (fromBlueprint) return fromBlueprint;

      if (paper.subject_id) {
        const subject = subjects.find((s) => s._id === paper.subject_id);
        if (subject?.course_id) return subject.course_id;
      }
      return '';
    },
    [getCourseIdFromBlueprint, subjects]
  );

  const getCourseById = (courseId: string) => courses.find((c) => c._id === courseId);

  const getCategoryIdFromCourse = (courseId: string) => {
    const course = courses.find((c) => c._id === courseId);
    return course?.category_id || '';
  };

  const getCategoryNameFromCourse = (courseId: string) => {
    const catId = getCategoryIdFromCourse(courseId);
    if (!catId) return '';
    return categories.find((c) => c._id === catId)?.name || '';
  };

  const isBatchActive = (batchPapers: StudentPaper[]) =>
    batchPapers.every(
      (p) => p.status === 'Generated' && !p.start_time
    );

  const buildAllotmentBatch = (courseId: string, batchPapers: StudentPaper[], index: number): AllotmentBatch => {
    const uniqueSubjects = new Set(batchPapers.map((p) => p.subject_id).filter(Boolean));
    const windowsWithDates = batchPapers
      .map((p) => p.start_window)
      .filter((w): w is string => !!w)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    const earliestWindow = windowsWithDates[0] || batchPapers[0]?.created_at || '';
    const minCreated = Math.min(...batchPapers.map((p) => new Date(p.created_at).getTime()));

    const papersBySubject: Map<string, StudentPaper[]> = new Map();
    const subjectPapersList: StudentPaper[] = [];
    batchPapers.forEach((p) => {
      const key = p.subject_id || '__nosubject__';
      if (!papersBySubject.has(key)) papersBySubject.set(key, []);
      papersBySubject.get(key)!.push(p);
    });

    const subjects: SubjectBatchInfo[] = Array.from(papersBySubject.entries()).map(([subjKey, papersForSubject]) => {
      const rep = papersForSubject[0];
      const blueprint = blueprints.find((b) => b._id === rep.blueprint_id);

      const subjSnap = rep.subject_config_snapshot;
      const bpSnap = rep.blueprint_snapshot;

      const durationMinutes: number | null =
        (typeof subjSnap?.duration_minutes === 'number' ? subjSnap.duration_minutes : null) ??
        (typeof bpSnap?.blueprint_duration_minutes === 'number' ? bpSnap.blueprint_duration_minutes : null) ??
        (typeof blueprint?.duration_minutes === 'number' ? blueprint.duration_minutes : null);

      const totalMarks: number | null =
        (typeof subjSnap?.final_subject_total_marks === 'number' ? subjSnap.final_subject_total_marks : null) ??
        (typeof bpSnap?.blueprint_total_marks === 'number' ? bpSnap.blueprint_total_marks : null) ??
        (typeof blueprint?.total_marks === 'number' ? blueprint.total_marks : null);

      const subjectName: string =
        rep.subject_name ||
        (subjKey === '__nosubject__'
          ? (rep.blueprint_snapshot?.name || blueprint?.name || 'Exam')
          : 'Subject');

      const sortedWindows = papersForSubject
        .map((p) => p.start_window)
        .filter((w): w is string => !!w)
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
      const subjEarliest = sortedWindows[0] || rep.start_window || rep.created_at;

      return {
        subjectId: rep.subject_id,
        subjectName,
        startWindow: rep.start_window,
        endWindow: rep.end_window,
        durationMinutes,
        totalMarks,
        examDate: subjEarliest ? formatISTDate(subjEarliest) : '—',
        examTime: subjEarliest ? formatISTTime(subjEarliest) : '—',
      };
    });

    const firstPaper = batchPapers[0];
    const firstBlueprint = firstPaper ? blueprints.find((b) => b._id === firstPaper.blueprint_id) : undefined;
    const blueprintName = firstPaper?.blueprint_snapshot?.name || firstBlueprint?.name;

    return {
      id: `${courseId}_${minCreated}_${index}`,
      courseId,
      papers: batchPapers,
      subjectCount: uniqueSubjects.size || 1,
      examDate: earliestWindow ? formatExamDate(earliestWindow) : '—',
      examTime: earliestWindow ? formatExamTime(earliestWindow) : '—',
      isActive: isBatchActive(batchPapers),
      allotmentDate: new Date(minCreated).toISOString().split('T')[0],
      subjects,
      blueprintName,
    };
  };

  const allotmentBatches = useMemo(() => {
    const byCourse: Record<string, StudentPaper[]> = {};
    papers.forEach((paper) => {
      const courseId = getCourseIdForPaper(paper);
      if (!courseId) return;
      if (!byCourse[courseId]) byCourse[courseId] = [];
      byCourse[courseId].push(paper);
    });

    const batches: AllotmentBatch[] = [];

    Object.entries(byCourse).forEach(([courseId, coursePapers]) => {
      const sorted = [...coursePapers].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      let currentBatch: StudentPaper[] = [];
      let batchStart = 0;

      sorted.forEach((paper) => {
        const t = new Date(paper.created_at).getTime();
        if (currentBatch.length === 0) {
          currentBatch = [paper];
          batchStart = t;
        } else if (t - batchStart < BATCH_GAP_MS) {
          currentBatch.push(paper);
        } else {
          batches.push(buildAllotmentBatch(courseId, currentBatch, batches.length));
          currentBatch = [paper];
          batchStart = t;
        }
      });

      if (currentBatch.length > 0) {
        batches.push(buildAllotmentBatch(courseId, currentBatch, batches.length));
      }
    });

    return batches.sort(
      (a, b) =>
        new Date(b.papers[0]?.created_at || 0).getTime() -
        new Date(a.papers[0]?.created_at || 0).getTime()
    );
  }, [papers, getCourseIdForPaper]);

  const filteredBatches = useMemo(() => {
    return allotmentBatches.filter((batch) => {
      if (filterCategory !== 'all') {
        const catId = getCategoryIdFromCourse(batch.courseId);
        if (catId !== filterCategory) return false;
      }
      if (filterCourse !== 'all' && batch.courseId !== filterCourse) return false;
      if (filterDate && batch.allotmentDate !== filterDate) return false;
      if (filterStatus === 'Active' && !batch.isActive) return false;
      if (filterStatus === 'Inactive' && batch.isActive) return false;
      return true;
    });
  }, [allotmentBatches, filterCategory, filterCourse, filterDate, filterStatus, courses]);

  const handleDelete = async (batch: AllotmentBatch) => {
    if (!confirm('Are you sure you want to delete this alloted exam? This will remove it for all students.')) return;

    setDeletingId(batch.id);
    try {
      const results = await Promise.all(
        batch.papers.map((p) => apiFetch(`/api/exam/papers/${p._id}`, { method: 'DELETE' }))
      );
      const failed = results.filter((r) => !r.ok).length;
      if (failed === 0) {
        toast.success('Alloted exam deleted successfully');
        fetchData();
      } else if (failed < results.length) {
        toast.warning(`Partially deleted: ${results.length - failed} succeeded, ${failed} failed`);
        fetchData();
      } else {
        toast.error('Failed to delete alloted exam');
      }
    } catch (error) {
      console.error('Failed to delete:', error);
      toast.error('Failed to delete alloted exam');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditClick = (batch: AllotmentBatch) => {
    const course = getCourseById(batch.courseId);
    navigate('/dashboard/exams/allot', {
      state: {
        editAllotment: {
          courseId: batch.courseId,
          categoryId: course?.category_id || '',
          papers: batch.papers,
        },
      },
    });
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl backdrop-blur-xl">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-white flex items-center gap-3">
              <CalendarClock className="w-7 h-7 text-blue-400" />
              Alloted Examinations
            </h1>
            <p className="text-xs font-semibold text-slate-400 mt-1">
              Active and past course exam allotments assigned across student batches
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePurgeFakeData}
              disabled={purging}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-400 rounded-xl font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
              title="Purge all test exam papers and batches"
            >
              <Trash2 className="w-4 h-4" />
              {purging ? "Purging..." : "Purge Test Data"}
            </button>
            <button
              onClick={() => navigate('/dashboard/exams/allot')}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              Allot New Exam
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-lg grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 backdrop-blur-md">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Category Filter</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-semibold focus:border-blue-500 outline-none"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Course Filter</label>
            <select
              value={filterCourse}
              onChange={(e) => setFilterCourse(e.target.value)}
              className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-semibold focus:border-blue-500 outline-none"
            >
              <option value="all">All Courses</option>
              {courses.map((course) => (
                <option key={course._id} value={course._id}>{course.course_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Allotment Date</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-semibold focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Status Filter</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-semibold focus:border-blue-500 outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active Window</option>
              <option value="Inactive">Completed / Closed</option>
            </select>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <Clock className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading exam allotments...</p>
            </div>
          </div>
        )}

        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBatches.map((batch) => {
              const course = getCourseById(batch.courseId);
              const categoryName = getCategoryNameFromCourse(batch.courseId);

              return (
                <div
                  key={batch.id}
                  className="bg-slate-900/90 rounded-2xl shadow-xl border border-slate-800 hover:border-blue-500/40 transition-all flex flex-col overflow-hidden group"
                >
                  <div className="p-5 flex-1 space-y-4">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <h3 className="font-extrabold text-base text-white leading-snug">
                          {course?.course_name || 'Unknown Course'}
                        </h3>
                        {categoryName && (
                          <span className="inline-block mt-1 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-md">
                            {categoryName}
                          </span>
                        )}
                      </div>
                      <span
                        className={`shrink-0 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full border ${
                          batch.isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {batch.isActive ? 'Active Window' : 'Closed'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Subjects</p>
                        <p className="font-black text-white text-sm mt-0.5">{batch.subjectCount} Modules</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Total Papers</p>
                        <p className="font-black text-blue-400 text-sm mt-0.5">{batch.papers.length} Enrolled</p>
                      </div>
                      <div className="col-span-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-slate-400">
                        <span className="flex items-center gap-1.5 font-medium text-[11px]">
                          <Calendar className="w-3.5 h-3.5 text-blue-400" />
                          {batch.examDate}
                        </span>
                        <span className="flex items-center gap-1.5 font-medium text-[11px]">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          {batch.examTime}
                        </span>
                      </div>
                    </div>

                    {batch.subjects.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400 border-t border-slate-800 pt-3">
                          <span className="flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-blue-400" />
                            {batch.subjects.length > 1 ? 'Subject Breakdown' : 'Subject Schedule'}
                          </span>
                          <span className="text-slate-500">{batch.subjects.length} Subjects</span>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {batch.subjects.map((sb, idx) => (
                            <div
                              key={idx}
                              className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 space-y-1.5 hover:border-slate-700 transition"
                            >
                              <div className="font-bold text-xs text-slate-200 truncate">
                                {sb.subjectName}
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-900">
                                <span>{sb.examDate} • {sb.examTime}</span>
                                <span className="font-bold text-blue-400">{sb.durationMinutes ? `${sb.durationMinutes}m` : '60m'} ({sb.totalMarks || 100} Marks)</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-800 p-3 bg-slate-950/40 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => window.open('/dashboard/exams/papers', '_blank')}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl font-bold transition"
                    >
                      <Ticket className="w-3.5 h-3.5" />
                      Hall Tickets
                    </button>
                    <button
                      onClick={() => window.open('/dashboard/exams/papers', '_blank')}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded-xl font-bold transition"
                    >
                      <Clock className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                      Live CBT Monitor
                    </button>
                    <button
                      onClick={() => window.open('/dashboard/exams/download-paper', '_blank')}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded-xl font-bold transition"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Paper Sets
                    </button>
                    <button
                      onClick={() => {
                        setPostponeBatch(batch);
                        setPostponeDays(2);
                        setPostponeMode('days');
                        setPostponeCustomDate('');
                        setPostponeReason('');
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-xl font-bold transition"
                    >
                      <CalendarClock className="w-3.5 h-3.5" />
                      Postpone
                    </button>
                    <button
                      onClick={() => handleEditClick(batch)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl font-bold transition"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(batch)}
                      disabled={deletingId === batch.id}
                      className="p-2 text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl font-bold transition disabled:opacity-50"
                      title="Delete Exam Allotment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredBatches.length === 0 && (
              <div className="col-span-full bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
                <AlertCircle className="w-10 h-10 text-slate-500 mx-auto" />
                <p className="text-slate-300 font-bold text-sm">No Alloted Exams Found</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">No exam allotments match your selected filters. Click "Allot New Exam" to generate papers for students.</p>
              </div>
            )}
          </div>
        )}

        {/* Postpone Exam Modal (Client Audio Point #8) */}
        <Dialog open={!!postponeBatch} onOpenChange={(open) => !open && setPostponeBatch(null)}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                <CalendarClock className="w-5 h-5 text-blue-600" />
                Postpone / Reschedule Exam
              </DialogTitle>
              <DialogDescription>
                Reschedule this examination batch for all enrolled students. The exam window start & end times will automatically shift.
              </DialogDescription>
            </DialogHeader>

            {postponeBatch && (
              <div className="space-y-4 py-2">
                <div className="bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="text-sm font-semibold text-foreground">
                    {getCourseById(postponeBatch.courseId)?.course_name || 'Course'}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>Enrolled Papers: <strong>{postponeBatch.papers.length}</strong></span>
                    <span>•</span>
                    <span>Current Exam Date: <strong>{postponeBatch.examDate}</strong></span>
                    <span>•</span>
                    <span>Start Time: <strong>{postponeBatch.examTime}</strong></span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Reschedule Method</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={postponeMode === 'days' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPostponeMode('days')}
                    >
                      Postpone by Days (+X)
                    </Button>
                    <Button
                      type="button"
                      variant={postponeMode === 'custom' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPostponeMode('custom')}
                    >
                      Set Exact New Date & Time
                    </Button>
                  </div>
                </div>

                {postponeMode === 'days' ? (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Quick Days Selection</Label>
                    <div className="grid grid-cols-5 gap-2">
                      {[2, 3, 4, 5, 7].map((d) => (
                        <Button
                          key={d}
                          type="button"
                          variant={postponeDays === d ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setPostponeDays(d)}
                          className="font-bold"
                        >
                          +{d} Days
                        </Button>
                      ))}
                    </div>
                    <div className="pt-1">
                      <Label htmlFor="custom-days-input" className="text-xs text-muted-foreground">Or enter custom number of days:</Label>
                      <Input
                        id="custom-days-input"
                        type="number"
                        min="1"
                        max="90"
                        value={postponeDays}
                        onChange={(e) => setPostponeDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="mt-1"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="custom-exam-datetime" className="text-sm font-medium">New Exam Start Date & Time</Label>
                    <Input
                      id="custom-exam-datetime"
                      type="datetime-local"
                      value={postponeCustomDate}
                      onChange={(e) => setPostponeCustomDate(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      All papers in this allotment batch will be shifted to start from this date/time.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="postpone-reason" className="text-sm font-medium">Reason for Rescheduling (Optional)</Label>
                  <Textarea
                    id="postpone-reason"
                    placeholder="e.g. Festival holiday, Center maintenance, or Administrative request"
                    value={postponeReason}
                    onChange={(e) => setPostponeReason(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setPostponeBatch(null)} disabled={postponing}>
                Cancel
              </Button>
              <Button type="button" onClick={handlePostponeSubmit} disabled={postponing} className="bg-blue-600 hover:bg-blue-700 text-white">
                {postponing ? 'Postponing...' : 'Confirm Postpone'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminAllotedExams;
