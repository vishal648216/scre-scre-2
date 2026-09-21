#!/usr/bin/env python3
"""
Live Exam Engine V2 E2E — hits E2E_BASE_URL (default https://screduc.com). Creates real data (no deletes).

Required environment variables (no credentials in source — see scripts/env.e2e.example):
  E2E_ADMIN_USER, E2E_ADMIN_PASS, E2E_STUDENT_USER, E2E_STUDENT_PASS
  E2E_CENTER_ID   — center **login user** ObjectId hex (output of create_exam_e2e_accounts)
  E2E_COURSE_ID   — course ObjectId hex
  E2E_SUBJECT_IDS — comma-separated subject ObjectId hex list (same course)

Optional:
  E2E_BASE_URL    — default https://screduc.com
  E2E_ADMIN_OID   — admin MongoDB hex for BSON payloads; if unset, uses JWT `sub` from admin login
  E2E_RUN_TAG     — suffix for bank/exam names (default: unix time) so each run resolves the right rows

Optional local file: scripts/.env.e2e (KEY=value lines) loaded if present (does not override existing env).
"""
from __future__ import annotations

import base64
import json
import os
import random
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone


def _load_dotenv_file(path: str) -> None:
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, _, v = line.partition("=")
                k, v = k.strip(), v.strip().strip('"').strip("'")
                if k and k not in os.environ:
                    os.environ[k] = v
    except OSError:
        pass


_load_dotenv_file(os.path.join(os.path.dirname(__file__), ".env.e2e"))


def _require(name: str) -> str:
    v = (os.environ.get(name) or "").strip()
    if not v:
        print(f"Missing required environment variable: {name}", file=sys.stderr)
        print("See scripts/env.e2e.example", file=sys.stderr)
        sys.exit(2)
    return v


def _jwt_sub(token: str) -> str | None:
    parts = token.split(".")
    if len(parts) < 2:
        return None
    payload_b64 = parts[1]
    pad = (-len(payload_b64)) % 4
    if pad:
        payload_b64 += "=" * pad
    try:
        raw = base64.urlsafe_b64decode(payload_b64.encode("ascii"))
        return str(json.loads(raw.decode("utf-8")).get("sub") or "") or None
    except (json.JSONDecodeError, ValueError, UnicodeDecodeError):
        return None


BASE = (os.environ.get("E2E_BASE_URL") or "https://screduc.com").rstrip("/")
ADMIN_USER = _require("E2E_ADMIN_USER")
ADMIN_PASS = _require("E2E_ADMIN_PASS")
STUDENT_USER = _require("E2E_STUDENT_USER")
STUDENT_PASS = _require("E2E_STUDENT_PASS")
CENTER_ID = _require("E2E_CENTER_ID")
COURSE_ID = _require("E2E_COURSE_ID")
_raw_subj = _require("E2E_SUBJECT_IDS")
SUBJECT_IDS = [x.strip() for x in _raw_subj.split(",") if x.strip()]
if not SUBJECT_IDS:
    print("E2E_SUBJECT_IDS must list at least one subject ObjectId", file=sys.stderr)
    sys.exit(2)

RUN_TAG = (os.environ.get("E2E_RUN_TAG") or "").strip() or str(int(datetime.now(timezone.utc).timestamp()))
BANK_NAME = f"E2E Bank {RUN_TAG}"
PAPER_TPL_NAME = f"E2E PaperTpl {RUN_TAG}"
EXAM_NAME = f"E2E Exam {RUN_TAG}"


def req(method: str, path: str, token: str | None = None, body: dict | None = None) -> tuple[int, object]:
    url = BASE + path
    data = None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=120) as resp:
            raw = resp.read().decode("utf-8")
            code = resp.status
            if not raw:
                return code, None
            try:
                return code, json.loads(raw)
            except json.JSONDecodeError:
                return code, raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8")
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, raw


def login(username: str, password: str) -> str:
    code, j = req("POST", "/api/auth/login", body={"username": username, "password": password})
    if code != 200 or not isinstance(j, dict) or not j.get("token"):
        print("LOGIN_FAIL", username, code, j, file=sys.stderr)
        sys.exit(1)
    return j["token"]


def oid_hex(x) -> str:
    if isinstance(x, str):
        return x
    if isinstance(x, dict) and "$oid" in x:
        return x["$oid"]
    return str(x)


def main() -> int:
    log: list[str] = []
    summary: dict = {}

    def L(msg: str) -> None:
        log.append(msg)
        print(msg)

    L(f"=== LIVE E2E Exam V2 ({BASE}) tag={RUN_TAG} ===")

    admin_t = login(ADMIN_USER, ADMIN_PASS)
    student_t = login(STUDENT_USER, STUDENT_PASS)

    admin_oid_env = (os.environ.get("E2E_ADMIN_OID") or "").strip()
    admin_oid = admin_oid_env or (_jwt_sub(admin_t) or "")
    if not admin_oid:
        print("Set E2E_ADMIN_OID or ensure admin JWT contains sub", file=sys.stderr)
        sys.exit(2)

    # Step 1: Question bank (include fields BSON deserializer expects; server overwrites created_*)
    bank_payload = {
        "name": BANK_NAME,
        "created_by": {"$oid": admin_oid},
        "created_at": {"$date": int(datetime.now(timezone.utc).timestamp() * 1000)},
    }
    code, bank_resp = req("POST", "/api/exam-v2/question-banks", admin_t, bank_payload)
    L(f"POST question-banks HTTP {code} {bank_resp}")
    if code not in (200, 201):
        L("FAIL: question bank")
        print("\n".join(log))
        return 1

    code, banks = req("GET", "/api/exam-v2/question-banks", admin_t)
    bank_id = None
    if isinstance(banks, list):
        for b in reversed(banks):
            if b.get("name") == BANK_NAME:
                bank_id = oid_hex(b.get("_id") or b.get("id"))
                break
    if not bank_id:
        L("FAIL: could not resolve bank id")
        print("\n".join(log))
        return 1
    summary["question_bank_id"] = bank_id
    L(f"Using bank_id={bank_id}")

    # Step 1b: 45 questions (15×2, 15×3, 15×5) across 3 subjects
    questions = []
    n = 0
    for subj in SUBJECT_IDS:
        for marks, count in [(2.0, 5), (3.0, 5), (5.0, 5)]:
            for i in range(count):
                n += 1
                opts = [f"OptA-{n}", f"OptB-{n}", f"OptC-{n}", f"OptD-{n}"]
                ca = random.choice(opts)
                questions.append(
                    {
                        "question_bank_id": {"$oid": bank_id},
                        "subject_id": {"$oid": subj},
                        "category": "e2e",
                        "question_type": "MCQ",
                        "difficulty": "medium",
                        "marks": marks,
                        "question_text": f"[E2E LIVE] Q{n} marks={marks} subj={subj[-6:]} pick correct.",
                        "options": opts,
                        "correct_answer": ca,
                        "usage_count": 0,
                        "created_by": {"$oid": admin_oid},
                        "created_at": {"$date": int(datetime.now(timezone.utc).timestamp() * 1000)},
                    }
                )

    code, bulk = req("POST", "/api/exam-v2/questions/bulk", admin_t, {"questions": questions})
    L(f"POST questions/bulk HTTP {code} {bulk}")
    if code not in (200, 201):
        L("FAIL: bulk questions")
        print("\n".join(log))
        return 1
    summary["questions_posted"] = len(questions)

    # Step 2–3: One full exam on primary subject; lighter repeats for other subjects
    exam_ids: list[str] = []
    paper_tpl_ids: list[str] = []
    student_id = None
    code, me = req("GET", "/api/students", student_t)
    if isinstance(me, list) and me:
        student_id = oid_hex(me[0].get("_id") or me[0].get("id"))
    if not student_id:
        L("FAIL: student self list")
        print("\n".join(log))
        return 1
    summary["student_id"] = student_id

    primary_subject = SUBJECT_IDS[0]
    tpl_body = {
        "name": PAPER_TPL_NAME,
        "question_bank_id": {"$oid": bank_id},
        "subject_id": {"$oid": primary_subject},
        "total_marks": 45.0,
        "duration_minutes": 25,
        "max_attempts": 3,
        "instructions": "Automated live E2E — answer all MCQs.",
        "sections": [{"marks": 2, "count": 10}, {"marks": 5, "count": 5}],
        "created_by": {"$oid": admin_oid},
        "created_at": {"$date": int(datetime.now(timezone.utc).timestamp() * 1000)},
    }
    code, _ = req("POST", "/api/exam-v2/paper-templates", admin_t, tpl_body)
    L(f"POST paper-templates HTTP {code}")
    if code not in (200, 201):
        L("FAIL: paper template")
        print("\n".join(log))
        return 1

    code, tpls = req("GET", "/api/exam-v2/paper-templates", admin_t)
    paper_tpl_id = None
    if isinstance(tpls, list):
        for t in reversed(tpls):
            if t.get("name") == PAPER_TPL_NAME:
                paper_tpl_id = oid_hex(t.get("_id") or t.get("id"))
                break
    if not paper_tpl_id:
        L("FAIL: resolve template id")
        print("\n".join(log))
        return 1
    paper_tpl_ids.append(paper_tpl_id)
    summary["paper_template_id"] = paper_tpl_id

    now = datetime.now(timezone.utc)
    start = now - timedelta(minutes=2)
    end = now + timedelta(hours=2)

    def dt_ms(d: datetime) -> dict:
        return {"$date": int(d.timestamp() * 1000)}

    exam_body = {
        "name": EXAM_NAME,
        "course_id": {"$oid": COURSE_ID},
        "paper_id": {"$oid": paper_tpl_id},
        "center_ids": [],
        "exam_mode": "online",
        "result_mode": "instant",
        "start_at": dt_ms(start),
        "end_at": dt_ms(end),
        "lock_ui_at": None,
        "attendance_date": dt_ms(now.replace(hour=0, minute=0, second=0, microsecond=0)),
        "require_attendance": False,
        "status": "live",
        "created_by": {"$oid": admin_oid},
        "created_at": {"$date": int(datetime.now(timezone.utc).timestamp() * 1000)},
    }
    code, ex = req("POST", "/api/exam-v2/exams", admin_t, exam_body)
    L(f"POST exams HTTP {code} {ex}")
    if code not in (200, 201):
        L("FAIL: create exam")
        print("\n".join(log))
        return 1

    code, exams = req("GET", "/api/exam-v2/exams", admin_t)
    exam_id = None
    if isinstance(exams, list):
        for e in reversed(exams):
            if e.get("name") == EXAM_NAME:
                exam_id = oid_hex(e.get("_id") or e.get("id"))
                break
    if not exam_id:
        L("FAIL: resolve exam id")
        print("\n".join(log))
        return 1
    exam_ids.append(exam_id)
    summary["exam_id"] = exam_id

    # Step 5: generate paper (admin)
    gen = {"exam_id": exam_id, "student_id": student_id, "center_id": CENTER_ID}
    code, g = req("POST", "/api/exam-v2/papers/generate", admin_t, gen)
    L(f"POST papers/generate HTTP {code} {g}")
    if code not in (200, 201):
        L("FAIL: generate paper")
        print("\n".join(log))
        return 1

    code, papers = req("GET", "/api/exam-v2/papers", student_t)
    paper_id = None
    if isinstance(papers, list):
        for p in reversed(papers):
            if oid_hex(p.get("exam_id")) == exam_id:
                paper_id = oid_hex(p.get("_id") or p.get("id"))
                break
    if not paper_id:
        L("FAIL: resolve paper id")
        print("\n".join(log))
        return 1
    summary["paper_id"] = paper_id

    # Start
    code, st = req("POST", f"/api/exam-v2/attempts/{paper_id}/start", student_t, {})
    L(f"POST start HTTP {code} {st}")
    if code != 200:
        L("FAIL: start")
        print("\n".join(log))
        return 1

    # Paper detail for question ids
    code, detail = req("GET", f"/api/exam-v2/papers/{paper_id}", student_t)
    if code != 200 or not isinstance(detail, dict):
        L(f"FAIL: get paper detail {code}")
        print("\n".join(log))
        return 1

    qrows = detail.get("questions") or []
    responses = []
    for q in qrows:
        qid = oid_hex(q.get("_id") or q.get("id"))
        opts = q.get("options") or []
        if opts:
            pick = random.randint(0, len(opts) - 1)
            responses.append({"question_id": qid, "response": str(pick)})
        else:
            responses.append({"question_id": qid, "response": "0"})

    # Autosave
    code, au = req("PATCH", f"/api/exam-v2/attempts/{paper_id}/autosave", student_t, {"responses": responses})
    L(f"PATCH autosave HTTP {code} {au}")

    # State / deadline
    code, state = req("GET", f"/api/exam-v2/attempts/{paper_id}/state", student_t)
    L(f"GET state HTTP {code} {state}")
    if isinstance(state, dict):
        summary["deadline_ms"] = state.get("deadline_ms")
        summary["status_after_autosave"] = state.get("status")

    # Submit
    code, sub = req(
        "POST",
        f"/api/exam-v2/attempts/{paper_id}/submit",
        student_t,
        {"responses": responses, "security_events": ["e2e_script"]},
    )
    L(f"POST submit HTTP {code} {sub}")

    code, detail2 = req("GET", f"/api/exam-v2/papers/{paper_id}", student_t)
    if isinstance(detail2, dict) and detail2.get("paper"):
        p = detail2["paper"]
        summary["final_status"] = p.get("status")
        summary["total_obtained_marks"] = p.get("total_obtained_marks")
        summary["question_count"] = len(p.get("questions") or [])
    L(f"GET paper after submit: status={summary.get('final_status')} marks={summary.get('total_obtained_marks')}")

    # Marksheet (admin) — requires evaluated
    ms_id = None
    if summary.get("final_status") == "evaluated":
        code, mg = req(
            "POST",
            "/api/exam-v2/marksheets/generate",
            admin_t,
            {"exam_id": exam_id, "student_id": student_id},
        )
        L(f"POST marksheets/generate HTTP {code} {mg}")
        code, mlist = req("GET", "/api/exam-v2/marksheets", admin_t)
        if isinstance(mlist, list):
            for m in reversed(mlist):
                if oid_hex(m.get("exam_id")) == exam_id and oid_hex(m.get("student_id")) == student_id:
                    ms_id = oid_hex(m.get("_id") or m.get("id"))
                    break
        summary["marksheet_id"] = ms_id
        if ms_id:
            code, pdf = req("POST", f"/api/exam-v2/marksheets/render-pdf/{ms_id}", admin_t, {})
            L(f"POST render-pdf HTTP {code} {pdf}")
            if isinstance(pdf, dict):
                summary["pdf_message"] = pdf.get("message")
    else:
        L("SKIP marksheet: paper not fully evaluated (expected if non-MCQ pending — all MCQ should evaluate)")

    # Multi-subject: extra paper templates + exams (abbreviated — same bank, different subject_ids)
    for si, subj in enumerate(SUBJECT_IDS[1:], start=1):
        name = f"E2E MultiTpl S{si} {RUN_TAG}"
        body = {
            "name": name,
            "question_bank_id": {"$oid": bank_id},
            "subject_id": {"$oid": subj},
            "total_marks": 45.0,
            "duration_minutes": 20,
            "max_attempts": 1,
            "instructions": "Multi-subject E2E",
            "sections": [{"marks": 2, "count": 10}, {"marks": 5, "count": 5}],
            "created_by": {"$oid": admin_oid},
            "created_at": {"$date": int(datetime.now(timezone.utc).timestamp() * 1000)},
        }
        code, _ = req("POST", "/api/exam-v2/paper-templates", admin_t, body)
        L(f"Multi POST paper-templates subj={subj[-6:]} HTTP {code}")
        if code not in (200, 201):
            continue
        code, tpls2 = req("GET", "/api/exam-v2/paper-templates", admin_t)
        tid = None
        if isinstance(tpls2, list):
            for t in reversed(tpls2):
                if t.get("name") == name:
                    tid = oid_hex(t.get("_id") or t.get("id"))
                    break
        if not tid:
            continue
        paper_tpl_ids.append(tid)
        ex2 = {
            "name": f"E2E Multi Exam S{si} {RUN_TAG}",
            "course_id": {"$oid": COURSE_ID},
            "paper_id": {"$oid": tid},
            "center_ids": [],
            "exam_mode": "online",
            "result_mode": "instant",
            "start_at": dt_ms(start),
            "end_at": dt_ms(end),
            "lock_ui_at": None,
            "attendance_date": exam_body["attendance_date"],
            "require_attendance": False,
            "status": "live",
            "created_by": {"$oid": admin_oid},
            "created_at": {"$date": int(datetime.now(timezone.utc).timestamp() * 1000)},
        }
        code, _ = req("POST", "/api/exam-v2/exams", admin_t, ex2)
        L(f"Multi POST exams HTTP {code}")
        if code in (200, 201):
            code, exams2 = req("GET", "/api/exam-v2/exams", admin_t)
            if isinstance(exams2, list):
                for e in reversed(exams2):
                    if e.get("name") == ex2["name"]:
                        exam_ids.append(oid_hex(e.get("_id") or e.get("id")))
                        break

    summary["exam_ids_all"] = exam_ids
    summary["paper_template_ids_all"] = paper_tpl_ids
    summary["subjects_used"] = SUBJECT_IDS

    L("=== SUMMARY ===")
    L(json.dumps(summary, indent=2))
    print("\n".join(log))
    return 0 if summary.get("final_status") in ("evaluated", "submitted") else 1


if __name__ == "__main__":
    raise SystemExit(main())
