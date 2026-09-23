import React, { useState, useEffect, useCallback, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { useNavigate, useLocation } from 'react-router-dom';
import { Pencil, Trash2, Plus, Calendar, Clock, BookOpen, FileText, CalendarClock, AlertCircle } from 'lucide-react';
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
  const navigate = useNavigate();
  const location = useLocation();

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
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">Alloted Exams</h1>
          <button
            onClick={() => navigate('/dashboard/exams/allot')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Allot New Exam
          </button>
        </div>

        <div className="bg-white p-4 rounded-lg shadow grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
            <select
              value={filterCourse}
              onChange={(e) => setFilterCourse(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="all">All Courses</option>
              {courses.map((course) => (
                <option key={course._id} value={course._id}>{course.course_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Allotment Date</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="all">All</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        {loading && <div className="text-center py-8 text-gray-500">Loading...</div>}

        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBatches.map((batch) => {
              const course = getCourseById(batch.courseId);
              const categoryName = getCategoryNameFromCourse(batch.courseId);

              return (
                <div
                  key={batch.id}
                  className="bg-white rounded-lg shadow border border-gray-100 flex flex-col"
                >
                  <div className="p-4 flex-1">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-semibold text-lg text-gray-900 leading-tight">
                        {course?.course_name || 'Unknown Course'}
                      </h3>
                      <span
                        className={`shrink-0 ml-2 px-2 py-1 text-xs rounded-full font-medium ${
                          batch.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {batch.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {categoryName && (
                      <span className="inline-block mb-3 px-2 py-0.5 text-xs bg-purple-100 text-purple-800 rounded-full">
                        {categoryName}
                      </span>
                    )}

                    <div className="space-y-2.5 text-sm">
                      <div className="flex items-center gap-2 text-gray-700">
                        <BookOpen className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="text-gray-500">Subjects:</span>
                        <span className="font-medium ml-auto">{batch.subjectCount}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-700">
                        <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="text-gray-500">Earliest Exam:</span>
                        <span className="font-medium ml-auto">{batch.examDate}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-700">
                        <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="text-gray-500">Earliest Start:</span>
                        <span className="font-medium ml-auto">{batch.examTime}</span>
                      </div>
                    </div>

                    {batch.subjects.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400 border-t pt-3">
                          <FileText className="w-3.5 h-3.5" />
                          {batch.subjects.length > 1 ? 'Subject Exams' : 'Subject Exam'}
                        </div>
                        {batch.subjects.map((sb, idx) => (
                          <div
                            key={idx}
                            className="rounded-md border border-blue-100 bg-blue-50/40 p-2.5 space-y-1.5"
                          >
                            <div className="font-semibold text-sm text-gray-800 leading-tight">
                              {sb.subjectName}
                            </div>
                            <div className="grid grid-cols-2 gap-1 text-[11px] text-gray-600">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-gray-400" />
                                <span className="text-gray-500">Date:</span>
                                <span className="font-semibold text-gray-700">{sb.examDate}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-gray-400" />
                                <span className="text-gray-500">Time:</span>
                                <span className="font-semibold text-gray-700">{sb.examTime}</span>
                              </div>
                              <div className="flex items-center gap-1 col-span-2">
                                <Clock className="w-3 h-3 text-gray-400" />
                                <span className="text-gray-500">Duration:</span>
                                <span className={cn(
                                  "font-semibold",
                                  sb.durationMinutes ? "text-blue-700" : "text-amber-600"
                                )}>
                                  {sb.durationMinutes ?? "—"} min
                                  {sb.durationMinutes === 60 && (
                                    <span className="ml-1.5 text-[9px] text-amber-600 uppercase tracking-wide">
                                      (check bp)
                                    </span>
                                  )}
                                </span>
                              </div>
                              {sb.totalMarks != null && (
                                <div className="flex items-center gap-1 col-span-2">
                                  <BookOpen className="w-3 h-3 text-gray-400" />
                                  <span className="text-gray-500">Marks:</span>
                                  <span className="font-semibold text-gray-700">{sb.totalMarks}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {batch.isActive && (
                    <div className="border-t px-4 py-3 flex gap-2">
                      <button
                        onClick={() => {
                          setPostponeBatch(batch);
                          setPostponeDays(2);
                          setPostponeMode('days');
                          setPostponeCustomDate('');
                          setPostponeReason('');
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 font-medium"
                      >
                        <CalendarClock className="w-3.5 h-3.5" />
                        Postpone
                      </button>
                      <button
                        onClick={() => handleEditClick(batch)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(batch)}
                        disabled={deletingId === batch.id}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {deletingId === batch.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {filteredBatches.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-500">
                No alloted exams found
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
