# Debug Session: certificate-blank-render
- **Status**: [OPEN]
- **Issue**: Generated certificate PDF opens successfully but renders as a visually blank page in the Admin Generate Certificates workflow.
- **Debug Server**: Not started yet
- **Log File**: Not created yet

## Reproduction Steps
1. Trigger certificate generation from the Admin `Generate Certificates & Marksheets` page.
2. Capture the generated certificate HTML before PDF conversion.
3. Verify template selection, background asset resolution, canvas element loading, placeholder replacement, browser rendering, and PDF output.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | The wrong default template/design is loaded for the selected course. | High | Low | Pending |
| B | Canvas elements are not loaded or are empty after DB lookup. | High | Low | Pending |
| C | Placeholder replacement produces incomplete/blank positioned HTML. | High | Medium | Pending |
| D | CSS/layout makes valid content invisible in browser or print mode. | Medium | Medium | Pending |
| E | HTML renders correctly in browser, but Chrome PDF generation drops the visual layers. | Medium | Medium | Pending |

## Log Evidence
- Pending instrumentation.

## Verification Conclusion
- Pending.
