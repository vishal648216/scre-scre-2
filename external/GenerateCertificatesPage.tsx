import { useEffect, useState, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { apiFetch, apiUrl } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Calendar, School, BookOpen, UserCheck, Loader2, Download, Printer, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

interface Template {
  _id: string;
  template_name: string;
  template_type: string;
}

interface Center {
  _id: string;
  name: string;
  code: string;
  /** Center login user id — matches ERP student `center_id` / student `parent_id`. */
  user_id?: string | { $oid?: string };
}

interface Course {
  id: string;
  course_name: string;
}

const toId = (v: unknown): string => {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "$oid" in (v as object)) return (v as { $oid: string }).$oid;
  if (v && typeof v === "object" && "_id" in (v as object)) return toId((v as any)._id);
  if (v && typeof v === "object") return JSON.stringify(v);
  return String(v ?? "");
};

/** Stable 24-char hex for comparing certificate template/student ids from GET /api/certificates (string, {$oid}, mixed case). */
function mongoIdHex(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") {
    const t = v.trim();
    return /^[a-f0-9]{24}$/i.test(t) ? t.toLowerCase() : t;
  }
  if (typeof v === "object" && v !== null && "$oid" in (v as object)) {
    const oid = (v as { $oid?: unknown }).$oid;
    if (typeof oid === "string") return mongoIdHex(oid);
  }
  const s = toId(v).trim();
  return /^[a-f0-9]{24}$/i.test(s) ? s.toLowerCase() : s;
}

/** Normalize BSON / ISO dates from GET /api/students */
function toOptionalIsoDate(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "$date" in v) {
    const d = (v as { $date: string | number | { $numberLong?: string } }).$date;
    if (typeof d === "string") return d;
    if (typeof d === "number" && !Number.isNaN(d)) return new Date(d).toISOString();
    if (typeof d === "object" && d && "$numberLong" in d) {
      const ms = Number((d as { $numberLong: string }).$numberLong);
      if (!Number.isNaN(ms)) return new Date(ms).toISOString();
    }
  }
  return undefined;
}

/** Same source as Center Students — GET /api/students — mapped for filters / table */
function mapUsersToErpStudents(
  users: Record<string, unknown>[],
  centersList: Center[],
  coursesList: Course[],
): ErpStudent[] {
  const courseNameById = new Map(coursesList.map((c) => [c.id, c.course_name]));
  return users.map((u) => {
    const uid = toId(u._id);
    const parentId = toId(u.parent_id);
    const center = centersList.find((c) => toId(c.user_id) === parentId);
    const rawCourse = (u.course != null ? String(u.course) : "").trim();
    const looksLikeOid = /^[a-f0-9]{24}$/i.test(rawCourse);
    const courseId = looksLikeOid ? rawCourse : undefined;
    const courseDisplay =
      courseId != null ? courseNameById.get(courseId) ?? rawCourse : rawCourse || undefined;
    const created =
      toOptionalIsoDate(u.created_at) ??
      (typeof u.created_at === "string" ? u.created_at : undefined);
    return {
      _id: uid,
      student_name: String(u.full_name ?? u.username ?? ""),
      registration_number: String(u.username ?? ""),
      course: courseDisplay || undefined,
      course_id: courseId,
      center_name: center?.name,
      center_id: parentId || undefined,
      created_at: created,
    };
  });
}

interface ErpStudent {
  _id: string;
  student_name: string;
  registration_number: string;
  course?: string;
  /** Course document id (hex) when enrolled by course id */
  course_id?: string;
  center_name?: string;
  center_id?: string;
  created_at?: string;
}

interface StoredCertificate {
  _id?: string;
  student_id?: unknown;
  template_id?: unknown;
}

interface PreviewRow {
  certificate_id: string;
  student_id: string;
  student_name: string;
}

export type IssueDocumentKind = "certificate" | "marksheet";

export default function GenerateCertificatesPage() {
  const location = useLocation();
  const issueKind: IssueDocumentKind = location.pathname.includes("/generate/marksheet")
    ? "marksheet"
    : "certificate";

  const copy = useMemo(
    () =>
      issueKind === "marksheet"
        ? {
            pageTitle: "Issue marksheets",
            pageSubtitle:
              "Select students, choose a marksheet template, then generate. Uses evaluated exam marks where available.",
            primaryCta: "Issue marksheets",
            tableSection: "Select students for marksheet",
            previewTitle: "Generated preview",
            previewHint: "Review marksheets before printing.",
            printCta: "Print marksheets",
            dialogTitle: "Issue marksheets",
            dialogHint: (n: number) => `Select a marksheet template for the ${n} selected students.`,
            templateLabel: "Marksheet template",
            templatePlaceholder: "Choose a marksheet template…",
            confirmCta: "Generate marksheets",
            downloadFilename: "Marksheet.pdf",
          }
        : {
            pageTitle: "Issue certificates",
            pageSubtitle:
              "1) Choose the template. 2) Turn Re-issue off to list students who do not have this template yet; turn Re-issue on to list only students who already have it (replace PDF). 3) Generate.",
            primaryCta: "Generate certificates",
            tableSection: "Select students for certificate",
            previewTitle: "Generated preview",
            previewHint: "Review certificates before printing.",
            printCta: "Print certificates",
            dialogTitle: "Issue certificates",
            dialogHint: (n: number) => `Select a certificate template for the ${n} selected students.`,
            templateLabel: "Certificate template",
            templatePlaceholder: "Choose a certificate template…",
            confirmCta: "Generate certificates",
            downloadFilename: "Certificate.pdf",
          },
    [issueKind],
  );

  const [templates, setTemplates] = useState<Template[]>([]);
  const [students, setStudents] = useState<ErpStudent[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [centerFilter, setCenterFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [fetchingCerts, setFetchingCerts] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  // Blob URL lets scripts run without srcDoc sandbox (allow-scripts + same-origin triggers a browser warning).
  const previewBlobUrl = useMemo(() => {
    if (!previewHtml) return null;
    const blob = new Blob([previewHtml], { type: "text/html;charset=utf-8" });
    return URL.createObjectURL(blob);
  }, [previewHtml]);

  useEffect(() => {
    return () => {
      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    };
  }, [previewBlobUrl]);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [marksheetDialogTemplate, setMarksheetDialogTemplate] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [issueMode, setIssueMode] = useState<"now" | "later">("now");
  const [issuedCerts, setIssuedCerts] = useState<StoredCertificate[]>([]);
  const [reissueMode, setReissueMode] = useState(false);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  /** Multi-page single PDF when multiple certificates generated (backend writes under /uploads/...). */
  const [combinedPdfUrl, setCombinedPdfUrl] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");

  const user = JSON.parse(sessionStorage.getItem("user") || "{}");
  const role = (user.role || "").toLowerCase().replace(" ", "");
  const isAdmin = role === "admin" || role === "superadmin";

  /** Templates + centers + courses + students (same list as /dashboard/students) */
  const loadIssueDocumentsData = useCallback(async () => {
    setLoading(true);
    try {
      const typeParam =
        issueKind === "marksheet" ? "template_type=marksheet" : "template_type=certificate";
      const [tRes, sRes, cRes, coRes] = await Promise.all([
        apiFetch(`/api/templates?${typeParam}`),
        apiFetch("/api/students"),
        apiFetch("/api/centers"),
        apiFetch("/api/courses"),
      ]);

      if (tRes.ok) {
        const data = await tRes.json();
        setTemplates(Array.isArray(data) ? data : []);
      } else setTemplates([]);

      const cData = cRes.ok ? await cRes.json() : [];
      const coData = coRes.ok ? await coRes.json() : [];
      const centersArr = Array.isArray(cData) ? cData : [];
      const coursesArr = Array.isArray(coData) ? coData : [];
      setCenters(centersArr);
      setCourses(coursesArr);

      if (sRes.ok) {
        const raw = await sRes.json();
        const users = Array.isArray(raw) ? raw : [];
        setStudents(
          mapUsersToErpStudents(users as Record<string, unknown>[], centersArr, coursesArr),
        );
      } else {
        setStudents([]);
        const msg = await sRes.text().catch(() => "");
        toast.error(msg || `Could not load students (${sRes.status})`);
      }

      setIssuedCerts([]);
    } catch (e) {
      setStudents([]);
      toast.error(e instanceof Error ? e.message : "Could not load students");
    } finally {
      setLoading(false);
    }
  }, [issueKind]);

  useEffect(() => {
    void loadIssueDocumentsData();
  }, [loadIssueDocumentsData]);

  /** Refresh certificate rows whenever the template changes so Issue vs Re-issue lists match the server. */
  useEffect(() => {
    if (issueKind !== "certificate" || !selectedTemplate) {
      setIssuedCerts([]);
      return;
    }
    let cancelled = false;
    setFetchingCerts(true);
    void (async () => {
      try {
        // Fetch ALL certificates for the center/admin to ensure we don't miss anything
        // and can filter correctly in the frontend.
        const certRes = await apiFetch(`/api/certificates`);
        if (!certRes.ok || cancelled) return;
        const rawC = await certRes.json();
        if (!cancelled) {
          const allCerts = Array.isArray(rawC) ? rawC : [];
          setIssuedCerts(allCerts);
        }
      } catch (e) {
        console.error("Failed to fetch certificates:", e);
      } finally {
        if (!cancelled) setFetchingCerts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [issueKind, selectedTemplate]);

  useEffect(() => {
    setSelectedTemplate("");
    setMarksheetDialogTemplate("");
    setSelectedIds(new Set());
    setPreviewHtml(null);
    setPreviewRows([]);
    setCombinedPdfUrl(null);
    setReissueMode(false);
    setIssueMode("now");
    setScheduledAt("");
  }, [issueKind]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const name = (s.student_name ?? "").toLowerCase();
      const reg = (s.registration_number ?? "").toLowerCase();
      const q = searchQuery.toLowerCase();
      const matchesSearch = name.includes(q) || reg.includes(q);
      const courseNameForId = courses.find((c) => c.id === courseFilter)?.course_name;
      const matchesCourse =
        courseFilter === "all" ||
        toId(s.course_id) === courseFilter ||
        s.course === courseFilter ||
        (courseNameForId != null && s.course === courseNameForId);
      const centerUserId = toId(s.center_id);
      const matchesCenter = centerFilter === "all" || centerUserId === centerFilter;
      
      let matchesDate = true;
      if (dateFrom || dateTo) {
        const studentDate = s.created_at ? new Date(s.created_at) : null;
        if (!studentDate) matchesDate = false;
        else {
          if (dateFrom && studentDate < new Date(dateFrom)) matchesDate = false;
          if (dateTo && studentDate > new Date(dateTo)) matchesDate = false;
        }
      }
      
      return matchesSearch && matchesCourse && matchesCenter && matchesDate;
    });
  }, [students, searchQuery, courseFilter, centerFilter, dateFrom, dateTo, courses]);

  /** Certificate: new issue = students without this template; Re-issue = only students who already have this template. */
  const eligibleStudents = useMemo(() => {
    if (issueKind !== "certificate") return filteredStudents;
    if (!selectedTemplate || fetchingCerts) return [];
    
    const tpl = mongoIdHex(selectedTemplate);
    // Build a Set of hex student IDs who have certificates for the SELECTED template.
    const withThisTemplate = new Set(
      issuedCerts
        .filter((c) => {
          const c_tpl = mongoIdHex(c.template_id);
          // If certificate has no template_id, we might want to be careful.
          // For now, only match if template_id matches.
          return c_tpl === tpl;
        })
        .map((c) => mongoIdHex(c.student_id))
        .filter((id) => id.length > 0)
    );

    console.log("Template:", tpl, "Students who already have this template:", Array.from(withThisTemplate));

    return filteredStudents.filter((s) => {
      const sid = mongoIdHex(s._id);
      const exists = withThisTemplate.has(sid);
      
      if (reissueMode) {
        // Only show students WHO HAVE a certificate already for this template.
        return exists;
      } else {
        // Only show students WHO DO NOT have a certificate yet for this template.
        return !exists;
      }
    });
  }, [issueKind, filteredStudents, issuedCerts, selectedTemplate, reissueMode, fetchingCerts]);

  useEffect(() => {
    if (issueKind !== "certificate") return;
    const allowed = new Set(eligibleStudents.map((s) => mongoIdHex(s._id)));
    setSelectedIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        const n = mongoIdHex(id);
        if (allowed.has(n)) next.add(n);
      });
      return next;
    });
  }, [issueKind, eligibleStudents]);

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    const rows = issueKind === "certificate" ? eligibleStudents : filteredStudents;
    const allFilteredIds = rows.map((s) => mongoIdHex(s._id));
    const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id));

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        allFilteredIds.forEach((id) => next.delete(id));
      } else {
        allFilteredIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handlePrimaryClick = () => {
    if (issueKind === "marksheet") {
      if (selectedIds.size === 0) {
        toast.error("Please select at least one student");
        return;
      }
      if (templates.length === 0) {
        toast.error("No marksheet templates. Create one under Attachments → Marksheet templates.");
        return;
      }
      setMarksheetDialogTemplate("");
      setIsTemplateDialogOpen(true);
      return;
    }
    if (!selectedTemplate) {
      toast.error("Select a certificate template first.");
      return;
    }
    if (selectedIds.size === 0) {
      toast.error("Please select at least one student");
      return;
    }
    void runGenerate();
  };

  const runGenerate = async (templateIdOverride?: string) => {
    const templateId =
      templateIdOverride ??
      (issueKind === "marksheet" ? marksheetDialogTemplate : selectedTemplate);
    if (!templateId) {
      toast.error("Please select a template");
      return;
    }
    setGenerateLoading(true);
    setPreviewHtml(null);
    setPreviewRows([]);
    setCombinedPdfUrl(null);
    setIsTemplateDialogOpen(false);

    try {
      const res = await apiFetch("/api/generate-certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: templateId,
          student_ids: Array.from(selectedIds),
          reissue: issueKind === "certificate" && reissueMode ? true : undefined,
          scheduled_at:
            issueKind === "certificate" && issueMode === "later" && scheduledAt
              ? new Date(scheduledAt).toISOString()
              : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success !== false) {
        if (typeof data.html === "string" && data.html.length > 0) {
          setPreviewHtml(data.html);
        } else {
          setPreviewHtml(null);
        }
        const rows: PreviewRow[] = Array.isArray(data.preview) ? data.preview : [];
        setPreviewRows(rows);
        const bulkUrl = (data as { combined_pdf_url?: string }).combined_pdf_url;
        if (typeof bulkUrl === "string" && bulkUrl.length > 0) {
          setCombinedPdfUrl(bulkUrl);
        } else {
          setCombinedPdfUrl(null);
        }
        toast.success(
          data.message ||
            (issueKind === "marksheet" ? "Marksheets processed successfully" : "Certificates processed successfully"),
        );
        setSelectedIds(new Set());
        if (issueKind === "certificate") {
          const certRes = await apiFetch("/api/certificates");
          if (certRes.ok) {
            const rawC = await certRes.json();
            setIssuedCerts(Array.isArray(rawC) ? rawC : []);
          }
        }
      } else {
        toast.error(data.message || "Operation failed");
      }
    } catch {
      toast.error("Operation failed");
    } finally {
      setGenerateLoading(false);
      if (issueKind === "certificate" && issueMode === "later") {
        setScheduledAt("");
      }
    }
  };

  const downloadCertificateById = async (certId: string) => {
    if (!certId) return;
    setDownloadingId(certId);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(apiUrl(`/api/certificates/download/${certId}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const cd = res.headers.get("content-disposition");
        const m = cd?.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
        a.download = (m?.[1] && decodeURIComponent(m[1].trim())) || `${certId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const ct = res.headers.get("content-type") || "";
        let detail = `HTTP ${res.status}`;
        if (ct.includes("application/json")) {
          try {
            const j = (await res.json()) as { message?: string; code?: string };
            if (j?.code === "PDF_MISSING") {
              detail =
                j.message ??
                "Certificate is saved but the PDF file is missing on the server. Re-issue the certificate or fix Chromium / UPLOAD_DIR on the API host.";
            } else if (j?.code === "CERT_NOT_FOUND") {
              detail =
                `${j.message ?? "Certificate not found."} If the Network tab shows HTML instead of JSON for /api, configure Apache/nginx to proxy /api to the Rust backend.`;
            } else if (j?.message) {
              detail = j.message;
            }
          } catch {
            /* ignore */
          }
        } else {
          try {
            const t = await res.text();
            if (t && t.length < 300) detail = t;
          } catch {
            /* ignore */
          }
        }
        toast.error(
          detail !== `HTTP ${res.status}`
            ? detail
            : res.status === 404
              ? "Not found — wrong link, no access, or certificate was removed."
              : "Download failed.",
        );
      }
    } catch {
      toast.error("Download failed");
    } finally {
      setDownloadingId(null);
    }
  };

  const printPreview = () => {
    if (!previewHtml) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(previewHtml);
    w.document.close();
    w.focus();
    const doc = w.document;
    window.setTimeout(() => {
      let printed = false;
      const runPrint = () => {
        if (printed) return;
        printed = true;
        w.print();
      };
      const incomplete = [...doc.querySelectorAll("img")].filter((img) => !img.complete);
      if (incomplete.length === 0) {
        runPrint();
        return;
      }
      const fallback = window.setTimeout(runPrint, 4000);
      let left = incomplete.length;
      const onDone = () => {
        left -= 1;
        if (left <= 0) {
          window.clearTimeout(fallback);
          runPrint();
        }
      };
      for (const img of incomplete) {
        img.addEventListener("load", onDone, { once: true });
        img.addEventListener("error", onDone, { once: true });
      }
    }, 100);
  };

  const tableRows = useMemo(() => {
    if (issueKind !== "certificate") return filteredStudents;
    return eligibleStudents;
  }, [issueKind, filteredStudents, eligibleStudents]);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary/70 mb-1">
              {issueKind === "marksheet" ? "Marksheets" : "Certificates"}
            </p>
            <h1 className="font-heading font-extrabold text-3xl uppercase tracking-tight text-foreground">
              {copy.pageTitle}
            </h1>
            <p className="text-muted-foreground text-sm font-medium mt-1 max-w-xl">{copy.pageSubtitle}</p>
          </div>
          <Button
            className="rounded-none font-bold uppercase tracking-widest px-8 py-6 shadow-xl shrink-0"
            disabled={
              generateLoading ||
              selectedIds.size === 0 ||
              (issueKind === "certificate" && !selectedTemplate)
            }
            onClick={handlePrimaryClick}
          >
            {generateLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserCheck className="w-4 h-4 mr-2" />}
            {copy.primaryCta}
            {selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
          </Button>
        </div>

        {issueKind === "certificate" && (
          <Card className="rounded-none border-border shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border py-4">
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em]">Step 1 — Template & issuance</CardTitle>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-1">
                Re-issue off: students without this template. Re-issue on: students who already have this template (regenerate PDF).
              </p>
            </CardHeader>
            <CardContent className="p-6 grid gap-6 lg:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest ml-1">{copy.templateLabel}</Label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger className="rounded-none border-border h-12">
                    <SelectValue placeholder={copy.templatePlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.length === 0 ? (
                      <SelectItem value="__none__" disabled className="text-muted-foreground">
                        No certificate templates — add one under Attachments
                      </SelectItem>
                    ) : (
                      templates.map((t) => (
                        <SelectItem key={mongoIdHex(toId(t._id))} value={mongoIdHex(toId(t._id))}>
                          {t.template_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 rounded-none border border-border p-4 bg-card">
                  <div className="space-y-1 min-w-0">
                    <p className="text-sm font-bold flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 shrink-0 text-primary" />
                      Re-issue
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Replace the existing PDF for this template after fixing student or center data. Preview and download use the new file.
                    </p>
                  </div>
                  <Switch checked={reissueMode} onCheckedChange={setReissueMode} className="shrink-0" />
                </div>
                {isAdmin && (
                  <div className="space-y-3 pt-2 border-t border-border">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Admin issuance</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIssueMode("now");
                          setScheduledAt("");
                        }}
                        className={cn(
                          "flex items-center justify-center gap-2 py-3 border text-[10px] font-black uppercase tracking-widest transition-all",
                          issueMode === "now"
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card border-border hover:bg-muted",
                        )}
                      >
                        <UserCheck className="w-4 h-4" />
                        Issue now
                      </button>
                      <button
                        type="button"
                        onClick={() => setIssueMode("later")}
                        className={cn(
                          "flex items-center justify-center gap-2 py-3 border text-[10px] font-black uppercase tracking-widest transition-all",
                          issueMode === "later"
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card border-border hover:bg-muted",
                        )}
                      >
                        <Calendar className="w-4 h-4" />
                        Schedule
                      </button>
                    </div>
                    {issueMode === "later" && (
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Date & time</Label>
                        <Input
                          type="datetime-local"
                          className="rounded-none border-border h-12"
                          value={scheduledAt}
                          onChange={(e) => setScheduledAt(e.target.value)}
                          min={new Date().toISOString().slice(0, 16)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {issueKind === "marksheet" && (
          <Card className="rounded-none border-border shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border py-4">
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em]">Step 1 — Marksheet Issuance</CardTitle>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-1">
                Configure issuance date and scheduling for marksheets.
              </p>
            </CardHeader>
            <CardContent className="p-6">
              {isAdmin && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Issuance mode</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIssueMode("now");
                            setScheduledAt("");
                          }}
                          className={cn(
                            "flex items-center justify-center gap-2 py-3 border text-[10px] font-black uppercase tracking-widest transition-all",
                            issueMode === "now"
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card border-border hover:bg-muted",
                          )}
                        >
                          <UserCheck className="w-4 h-4" />
                          Issue now
                        </button>
                        <button
                          type="button"
                          onClick={() => setIssueMode("later")}
                          className={cn(
                            "flex items-center justify-center gap-2 py-3 border text-[10px] font-black uppercase tracking-widest transition-all",
                            issueMode === "later"
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card border-border hover:bg-muted",
                          )}
                        >
                          <Calendar className="w-4 h-4" />
                          Schedule
                        </button>
                      </div>
                    </div>
                    {issueMode === "later" && (
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Date & time</Label>
                        <Input
                          type="datetime-local"
                          className="rounded-none border-border h-12"
                          value={scheduledAt}
                          onChange={(e) => setScheduledAt(e.target.value)}
                          min={new Date().toISOString().slice(0, 16)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
              {!isAdmin && (
                <p className="text-sm text-muted-foreground font-medium">
                  Select students below and click "{copy.primaryCta}" to submit marksheet applications for approval.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Filters Section */}
        <Card className="rounded-none border-border shadow-sm bg-muted/20">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Search Students</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Name or Registration..." 
                    className="pl-10 rounded-none border-border bg-background"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Filter by Course</Label>
                <div className="relative">
                  <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                  <Select value={courseFilter} onValueChange={setCourseFilter}>
                    <SelectTrigger className="pl-10 rounded-none border-border bg-background">
                      <SelectValue placeholder="All Courses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Courses</SelectItem>
                      {courses.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.course_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Filter by Center</Label>
                <div className="relative">
                  <School className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                  <Select value={centerFilter} onValueChange={setCenterFilter}>
                    <SelectTrigger className="pl-10 rounded-none border-border bg-background">
                      <SelectValue placeholder="All Centers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Centers</SelectItem>
                      {centers.map(c => (
                        <SelectItem key={toId(c._id)} value={toId(c.user_id)}>
                          {c.name} ({c.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Registration Date</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input 
                    type="date" 
                    className="rounded-none border-border bg-background text-xs" 
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                  <Input 
                    type="date" 
                    className="rounded-none border-border bg-background text-xs" 
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Student List Section */}
        <Card className="rounded-none border-border shadow-md overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border py-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-primary" />
                {issueKind === "certificate" ? (
                  <>
                    Step 2 — {copy.tableSection}
                    <span className="font-mono font-normal normal-case text-[10px] text-muted-foreground">
                      {selectedTemplate
                        ? ` · ${eligibleStudents.length} eligible · ${filteredStudents.length} matching filters`
                        : ` · ${filteredStudents.length} matching filters (select template)`}
                    </span>
                  </>
                ) : (
                  <>
                    {copy.tableSection} ({filteredStudents.length} results)
                  </>
                )}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="rounded-none text-[10px] font-black uppercase tracking-widest h-8"
                onClick={selectAllFiltered}
                disabled={issueKind === "certificate" && !selectedTemplate}
              >
                {tableRows.length > 0 && tableRows.every((s) => selectedIds.has(toId(s._id)))
                  ? "Deselect all shown"
                  : "Select all shown"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="sticky top-0 bg-muted/90 backdrop-blur-sm z-10 border-b border-border">
                  <tr className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <th className="px-6 py-3 w-10">
                      <Checkbox
                        checked={
                          tableRows.length > 0 &&
                          tableRows.every((s) => selectedIds.has(toId(s._id)))
                        }
                        onCheckedChange={selectAllFiltered}
                        disabled={issueKind === "certificate" && !selectedTemplate}
                      />
                    </th>
                    <th className="px-6 py-3">Student Name</th>
                    <th className="px-6 py-3">Registration No.</th>
                    <th className="px-6 py-3">Course</th>
                    <th className="px-6 py-3">Center</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading || fetchingCerts ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          {fetchingCerts ? "Checking Certificates..." : "Loading Students..."}
                        </span>
                      </td>
                    </tr>
                  ) : issueKind === "certificate" && !selectedTemplate ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground leading-relaxed max-w-lg mx-auto">
                        Select a certificate template above. The list will show only students who can still receive that
                        template (or only those who already have it when Re-issue is on).
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        No students found matching filters
                      </td>
                    </tr>
                  ) : issueKind === "certificate" && tableRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground leading-relaxed max-w-xl mx-auto">
                        {reissueMode
                          ? "No students have this template yet. Turn off Re-issue to issue new certificates."
                          : "Everyone listed under your filters already has this template. Turn on Re-issue to regenerate and replace their PDFs after data corrections."}
                      </td>
                    </tr>
                  ) : (
                    tableRows.map((s) => {
                      const sid = mongoIdHex(s._id);
                      const isSelected = selectedIds.has(sid);
                      const existingCert = issuedCerts.find(c => mongoIdHex(c.student_id) === sid);
                      
                      return (
                        <tr
                          key={sid}
                          className={`hover:bg-primary/5 transition-colors cursor-pointer ${isSelected ? "bg-primary/5" : ""}`}
                          onClick={() => toggleStudent(sid)}
                        >
                          <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleStudent(sid)}
                            />
                          </td>
                          <td className="px-6 py-4 font-bold">{s.student_name}</td>
                          <td className="px-6 py-4 text-xs font-mono">{s.registration_number}</td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2 py-1 rounded-none border border-primary/20 bg-primary/5 text-[10px] font-black uppercase tracking-widest">
                              {s.course || "N/A"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs font-medium">{s.center_name || "N/A"}</td>
                          <td className="px-6 py-4 text-xs text-muted-foreground">
                            {existingCert ? (
                              <div className="flex items-center gap-2">
                                <span className="text-emerald-600 font-bold uppercase text-[10px]">Issued</span>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-6 w-6 p-0" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (existingCert._id) downloadCertificateById(existingCert._id);
                                  }}
                                  disabled={downloadingId === existingCert._id}
                                >
                                  {downloadingId === existingCert._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                                </Button>
                              </div>
                            ) : (
                              <span className="text-muted-foreground uppercase text-[10px]">Not Issued</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Preview + issued rows (full HTML documents render correctly in iframe, not as innerHTML) */}
        {(previewHtml || previewRows.length > 0) && (
          <Card className="rounded-none border-border shadow-xl overflow-hidden border-t-4 border-t-primary animate-in slide-in-from-bottom-4 duration-500">
            <CardHeader className="bg-muted/30 border-b border-border flex flex-row flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <Printer className="w-4 h-4 text-primary" />
                  {copy.previewTitle}
                </CardTitle>
                <p className="text-[10px] text-muted-foreground mt-1 font-medium uppercase tracking-widest">
                  {copy.previewHint}
                  {previewRows.length > 0 ? ` · ${previewRows.length} issued this run` : ""}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {previewHtml ? (
                  <Button
                    variant="outline"
                    className="rounded-none font-bold uppercase tracking-widest text-[10px] h-9"
                    onClick={printPreview}
                  >
                    <Printer className="w-3 h-3 mr-2" />
                    {copy.printCta}
                  </Button>
                ) : null}
                {combinedPdfUrl && previewRows.length > 1 ? (
                  <Button
                    variant="secondary"
                    className="rounded-none font-bold uppercase tracking-widest text-[10px] h-9"
                    onClick={() => {
                      window.open(apiUrl(combinedPdfUrl), "_blank", "noopener,noreferrer");
                    }}
                  >
                    <Download className="w-3 h-3 mr-2" />
                    All pages (one PDF)
                  </Button>
                ) : null}
                <Button
                  className="rounded-none font-bold uppercase tracking-widest text-[10px] h-9"
                  onClick={() => {
                    setPreviewHtml(null);
                    setPreviewRows([]);
                    setCombinedPdfUrl(null);
                  }}
                >
                  Close preview
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 bg-muted/10 space-y-0">
              {previewBlobUrl ? (
                <iframe
                  className="w-full min-h-[720px] border-0 bg-white block"
                  title="Document preview"
                  src={previewBlobUrl}
                />
              ) : (
                <div className="p-6 text-sm text-muted-foreground border-b border-border bg-muted/30">
                  No combined HTML preview in this response. Download PDFs from the table below when generation has
                  finished (large batches may take a few seconds).
                </div>
              )}
              {previewRows.length > 0 && (
                <div className="p-6 space-y-3 border-t border-border">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Generated documents — student mapping
                  </p>
                  <div className="overflow-x-auto border border-border rounded-none">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border">
                        <tr>
                          <th className="px-4 py-2">Student</th>
                          <th className="px-4 py-2">Certificate ID</th>
                          <th className="px-4 py-2 w-[140px]">PDF</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {previewRows.map((row) => (
                          <tr key={row.certificate_id}>
                            <td className="px-4 py-2 font-medium">{row.student_name}</td>
                            <td className="px-4 py-2 text-xs font-mono text-muted-foreground">{row.certificate_id}</td>
                            <td className="px-4 py-2">
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="rounded-none text-[10px] font-bold uppercase h-8"
                                disabled={downloadingId === row.certificate_id}
                                onClick={() => void downloadCertificateById(row.certificate_id)}
                              >
                                {downloadingId === row.certificate_id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <>
                                    <Download className="w-3 h-3 mr-1" />
                                    Download
                                  </>
                                )}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Marksheet: template picker in dialog (certificates use the card above) */}
        <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
          <DialogContent className="rounded-none border-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading font-extrabold text-xl uppercase tracking-tight">
                {copy.dialogTitle}
              </DialogTitle>
              <p className="text-sm text-muted-foreground font-medium">{copy.dialogHint(selectedIds.size)}</p>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest ml-1">{copy.templateLabel}</Label>
                <Select value={marksheetDialogTemplate} onValueChange={setMarksheetDialogTemplate}>
                  <SelectTrigger className="rounded-none border-border h-12">
                    <SelectValue placeholder={copy.templatePlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.length === 0 ? (
                      <SelectItem value="__none__" disabled className="text-muted-foreground">
                        No marksheet templates — add one under Attachments
                      </SelectItem>
                    ) : (
                      templates.map((t) => (
                        <SelectItem key={toId(t._id)} value={toId(t._id)}>
                          {t.template_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="flex flex-row gap-2 sm:justify-end">
              <Button
                variant="outline"
                className="rounded-none font-bold uppercase tracking-widest text-[10px]"
                onClick={() => setIsTemplateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="rounded-none font-bold uppercase tracking-widest text-[10px] px-8"
                disabled={!marksheetDialogTemplate || generateLoading}
                onClick={() => void runGenerate()}
              >
                {generateLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-2" />
                ) : (
                  <Download className="w-3 h-3 mr-2" />
                )}
                {copy.confirmCta}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
