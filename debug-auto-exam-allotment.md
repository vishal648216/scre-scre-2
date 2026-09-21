# Debug Session: auto-exam-allotment
- **Status**: [OPEN]
- **Issue**: Automatic exam allotment is not allotting exams for eligible students on the configured allotment day, and allotted exams must appear properly in the student panel.
- **Debug Server**: http://127.0.0.1:7780/event
- **Log File**: `.dbg/trae-debug-log-auto-exam-allotment.ndjson`

## Reproduction Steps
1. Enable automatic exam scheduling in admin settings.
2. Set `Exam Allotment Day` to today's IST day-of-month.
3. Ensure at least one course has a default exam blueprint and eligible students.
4. Wait for scheduler/manual trigger and verify whether papers are created and visible to students.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | `auto_allot_exams()` returns early because of settings/day/duplicate-batch checks. | High | Low | Pending |
| B | Students are fetched, but all are rejected by eligibility checks. | High | Medium | Pending |
| C | Eligible students reach paper creation, but `insert_generated_student_paper()` fails. | High | Medium | Pending |
| D | Papers are created successfully, but the student-side listing/query path hides them. | Medium | Medium | Pending |
| E | Manual trigger/scheduler runs asynchronously, but failures are swallowed and never surfaced. | Medium | Low | Pending |

## Log Evidence
- DB evidence: `system_settings` currently stored `auto_exam_enabled: true`, `auto_exam_allotment_day: 24`, `auto_exam_day: 25`, so the scheduler would skip on `2026-07-23` before eligibility checks.
- DB evidence: one default blueprint exists for course `69ef5c51dbbd001e2044ba8a`.
- DB evidence: that blueprint's subjects already have `158` active generated/in-progress papers, so many students are correctly ineligible for duplicate allotment.
- DB evidence: there are still `2` likely first-attempt candidates with ended sessions and no active papers, so a valid run on the matching day should still create new papers.
- Code-path evidence: student exam list reads directly from `student_papers` filtered by `student_id`, so successfully inserted papers will surface in the student panel.

## Verification Conclusion
- Confirmed `A`: scheduler can silently exit before work begins due to saved settings mismatch and sparse saved values.
- Confirmed partial `B`: most students are already blocked by existing active papers, but at least two likely candidates remain.
- Rejected `D` as primary cause: student panel path is simple and should show created papers once inserted.
- Implemented fix: normalize/save concrete auto-exam settings, default `exam_day` to `allotment_day` when absent, mark automatic batches explicitly, and avoid writing empty automatic batches that would block the day.
