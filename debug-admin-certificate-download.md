# Debug Session: admin-certificate-download

Status: OPEN

## Symptom
- Admin Panel -> Generate Certificates -> Download returns a downloaded file.
- Browser reports "Failed to load PDF document".
- Student listings/records in the table are correct.
- Scope must remain limited to the Generate Certificates page download workflow.

## Constraints
- Do not modify Student Panel.
- Do not modify existing certificate generation outside this workflow.
- Do not modify existing marksheet generation.
- Do not modify fee receipts, wallet receipts, or ID cards.
- Do not modify the PDF generator unless runtime evidence proves it is the root cause.

## Initial Hypotheses
1. Frontend Download button calls a different API or sends wrong identifiers.
2. Admin handler resolves a wrong certificate/template/default template.
3. Generated HTML or generated PDF is invalid before HTTP response.
4. Generated PDF is valid on disk but bytes change during file read / response creation.
5. Admin flow downloads a different artifact than the one generated for the selected record.

## Investigation Plan
1. Trace frontend download call from GenerateCertificatesPage.
2. Trace Rust route and exact handler.
3. Compare broken Admin flow with working Student Panel certificate flow.
4. Add instrumentation logs only in the broken flow and shared points required for comparison.
5. Reproduce and capture runtime evidence for endpoint, IDs, template, HTML, PDF file metadata, and response bytes.
6. Fix only the first proven divergence point.
7. Verify generated PDF and downloaded PDF integrity.
