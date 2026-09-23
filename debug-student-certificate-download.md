# Debug Session: student-certificate-download
- **Status**: [OPEN]
- **Issue**: Student panel marksheet downloads work, but certificate downloads fail after auto-generation.
- **Debug Server**: Pending
- **Log File**: .dbg/trae-debug-log-student-certificate-download.ndjson

## Reproduction Steps
1. Auto-generate certificate and marksheet for a student/course.
2. Open the student panel document/download area.
3. Download the marksheet and observe success.
4. Download the certificate and observe failure.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | Student panel certificate and marksheet use different APIs/handlers, and the certificate route is broken or mismatched. | High | Low | Confirmed |
| B | Certificate response/file-serving behavior differs from marksheet, causing download failure in the student panel only. | High | Medium | Confirmed |
| C | Auto-generated certificate records store invalid metadata/path/design linkage, while marksheet records are valid. | High | Medium | Confirmed |
| D | Recent manual edits/commented code changed only the certificate workflow and bypassed the working path used by marksheets. | Medium | Medium | Confirmed |
| E | Certificate lookup picks the wrong course default design/template for student downloads, causing missing or invalid certificate documents. | Medium | Medium | Rejected |

## Log Evidence
- Student panel certificate downloads use `/api/certificates/download/:id`; student marksheets can use `/api/marksheets/:id/download` or the shared certificate route depending on page.
- Real student sample `s35@gmail.com` had two approved rows: marksheet `SC-73965` with `file_path=marksheets/SC-73965.pdf`, and certificate `SC-82999` with `file_path=null`.
- `SC-82999` already had valid `student_id`, `course_id`, `center_id`, `template_id`, and the template matched the course default certificate design with 15 fields.
- Disk inspection showed `backend/uploads/certificates` contained only `SC-82858.pdf`; most approved certificate rows pointed to missing files.
- The admin/manual certificate generator already uses a stronger per-row `certificate_no` PDF path and reliable regeneration path, but the student certificate download path still failed when no PDF artifact existed.

## Verification Conclusion
- Root cause 1: auto-generated certificate rows can remain `approved` while `file_path` stays null and no PDF exists on disk, so the student panel lists a downloadable certificate that has no artifact.
- Root cause 2: the stable shared generator had an unsafe certificate lookup path that could resolve by `student_id` alone, risking collision with marksheet rows during reissue/recovery.
- Fix applied:
- Hardened `process_generate_certificates()` certificate reissue lookup to target certificate rows by `student_id + template_id + certificate_type=certificate`, with safe fallbacks.
- Added student download recovery in `download_certificate()` to reuse the stable certificate generator when the PDF file is missing, then serve the regenerated file.
- Persisted rendered HTML on auto-generated certificate rows in `certificate_automation.rs` so future missing-file rows still have enough data for self-healing.
