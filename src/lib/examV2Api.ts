import { apiFetch } from "@/lib/api";

export type V2PaperStatus = "generated" | "in_progress" | "submitted" | "evaluated";

export async function fetchV2Papers() {
  const res = await apiFetch("/api/exam-v2/papers");
  if (!res.ok) throw new Error("Failed to load papers");
  return res.json();
}

export async function fetchV2Exams() {
  const res = await apiFetch("/api/exam-v2/exams");
  if (!res.ok) throw new Error("Failed to load exams");
  return res.json();
}

export async function fetchV2PaperDetail(id: string) {
  const res = await apiFetch(`/api/exam-v2/papers/${id}`);
  if (!res.ok) throw new Error("Failed to load paper");
  return res.json();
}

export async function fetchV2AttemptState(paperId: string) {
  const res = await apiFetch(`/api/exam-v2/attempts/${paperId}/state`);
  if (!res.ok) throw new Error("state");
  return res.json() as Promise<{ server_now_ms: number; deadline_ms: number | null; status: string }>;
}

export async function postV2Start(paperId: string) {
  return apiFetch(`/api/exam-v2/attempts/${paperId}/start`, { method: "POST" });
}

export async function patchV2Autosave(paperId: string, responses: { question_id: string; response: string }[]) {
  return apiFetch(`/api/exam-v2/attempts/${paperId}/autosave`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ responses }),
  });
}

export async function postV2Submit(
  paperId: string,
  payload: { responses: { question_id: string; response: string }[]; security_events?: string[] }
) {
  return apiFetch(`/api/exam-v2/attempts/${paperId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/** Admin or center: create a per-student attempt (`exam_v2_papers`) before the student can open the exam. */
export async function postV2GeneratePaper(payload: {
  exam_id: string;
  student_id: string;
  center_id: string;
}) {
  return apiFetch("/api/exam-v2/papers/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function fetchV2Marksheets() {
  const res = await apiFetch("/api/exam-v2/marksheets");
  if (!res.ok) throw new Error("marksheets");
  return res.json() as Promise<
    Array<{
      _id: string;
      exam_id: string;
      student_id: string;
      status: string;
      pdf_path?: string;
      obtained_marks: number;
      total_marks: number;
    }>
  >;
}

export async function fetchStudentExamContext() {
  const res = await apiFetch("/api/exam-v2/student/exam-context");
  if (!res.ok) throw new Error("context");
  return res.json() as Promise<{
    server_now_ms: number;
    exam_lock: null | {
      exam_id: string;
      exam_name: string;
      paper_id: string;
      lock_at_ms: number;
      start_at_ms: number;
      end_at_ms: number;
    };
  }>;
}
