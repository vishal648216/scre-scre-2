[OPEN] Admin certificate PDF invalid debug session

Session ID: admin-certificate-pdf
Date: 2026-07-28

Scope:
- Admin Panel -> Generate Certificates page
- Admin Panel -> Generate Marksheets page only if needed for comparison
- No business-logic changes before first failing point is proven

Pipeline Under Trace:
1. GenerateCertificatesPage
2. Generate Certificate button
3. Frontend API call
4. Backend route
5. Handler
6. Template lookup
7. Default template resolution
8. Template fields
9. Student data mapping
10. HTML generation
11. Generated HTML
12. HTML validation
13. PDF generator
14. Generated PDF file on disk
15. Downloaded bytes

Falsifiable Hypotheses:
1. Admin Generate Certificate uses a different frontend endpoint or backend handler than expected, and the broken path diverges before template rendering.
2. Default certificate template resolution selects the wrong template or no default template for the student's course, producing malformed HTML or an invalid render target.
3. Template placeholder substitution is incomplete, leaving unresolved tokens or invalid asset URLs in the rendered HTML.
4. Admin certificate HTML generation differs from the working Student Panel certificate HTML in a way that causes Chrome PDF generation to emit an invalid PDF.
5. Admin certificate generation does not reuse the same PDF generation function or passes different inputs/options, causing the on-disk PDF to already be structurally broken.

Evidence Plan:
- Prove frontend endpoint and backend handler mapping
- Prove default template selection chain for the actual student/course
- Capture exact rendered HTML to /tmp/debug_certificate.html
- Validate HTML before PDF generation
- Validate generated PDF on disk with file/pdfinfo/qpdf/mutool/pdfcpu
- Compare against working Student Panel output at HTML and PDF levels

Status:
- Debug session initialized
- No business-logic modifications made
