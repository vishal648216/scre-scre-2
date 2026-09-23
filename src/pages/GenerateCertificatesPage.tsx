// import { useEffect, useState, useMemo, useCallback } from "react";
// import DashboardLayout from "@/components/DashboardLayout";
// import { apiFetch, apiUrl } from "@/lib/api";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { Search, Download, Award, Loader2, FileSpreadsheet, FileBadge } from "lucide-react";
// import { toast } from "sonner";

// interface Category {
//   id: string;
//   name: string;
// }

// interface CourseItem {
//   id: string;
//   course_name: string;
// }

// interface StudentAttempt {
//   attempt_number: number;
//   marksheet_id?: string | null;
//   certificate_id?: string | null;
// }

// interface EligibleStudent {
//   id: string;
//   student_id: string;
//   student_name: string;
//   full_name: string;
//   registration_number: string;
//   father_name?: string | null;
//   enrollment_number?: string | null;
//   course: string;
//   course_name: string;
//   center_name?: string | null;
//   attempts: StudentAttempt[];
// }

// function normalizeId(v: any): string {
//   if (v == null) return "";
//   if (typeof v === "string") {
//     const t = v.trim();
//     return /^[a-f0-9]{24}$/i.test(t) ? t.toLowerCase() : t;
//   }
//   if (typeof v === "object" && v !== null) {
//     if ("$oid" in v && typeof (v as any).$oid === "string") {
//       return normalizeId((v as any).$oid);
//     }
//     if ("id" in v) return normalizeId((v as any).id);
//     if ("_id" in v) return normalizeId((v as any)._id);
//   }
//   return String(v ?? "").toLowerCase();
// }

// const SENTINEL_ALL_CATEGORIES = "__all_categories__";
// const SENTINEL_ALL_COURSES = "__all_courses__";
// const DEBUG_SERVER_URL = "http://127.0.0.1:7780/event";
// const DEBUG_SESSION_ID = "admin-certificate-download";

// async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
//   const digest = await crypto.subtle.digest("SHA-256", buffer);
//   return Array.from(new Uint8Array(digest))
//     .map((b) => b.toString(16).padStart(2, "0"))
//     .join("");
// }

// function hexSlice(bytes: Uint8Array): string {
//   return Array.from(bytes)
//     .map((b) => b.toString(16).padStart(2, "0"))
//     .join("");
// }

// async function debugReport(
//   hypothesisId: string,
//   location: string,
//   msg: string,
//   data: Record<string, unknown>,
// ) {
//   try {
//     await fetch(DEBUG_SERVER_URL, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({
//         sessionId: DEBUG_SESSION_ID,
//         runId: "pre-fix",
//         hypothesisId,
//         location,
//         msg,
//         data,
//         ts: Date.now(),
//       }),
//     });
//   } catch {
//     // Keep production behavior unchanged if the debug server is unavailable.
//   }
// }

// export default function GenerateCertificatesPage() {
//   const [searchQuery, setSearchQuery] = useState("");
//   const [debouncedSearch, setDebouncedSearch] = useState("");
//   const [selectedCategory, setSelectedCategory] = useState<string>("");
//   const [selectedCourse, setSelectedCourse] = useState<string>("");

//   const [categories, setCategories] = useState<Category[]>([]);
//   const [courses, setCourses] = useState<CourseItem[]>([]);
//   const [students, setStudents] = useState<EligibleStudent[]>([]);

//   const [loadingStudents, setLoadingStudents] = useState(false);
//   const [loadingCategories, setLoadingCategories] = useState(false);
//   const [loadingCourses, setLoadingCourses] = useState(false);
//   const [generatingMap, setGeneratingMap] = useState<Record<string, boolean>>({});
//   const [downloading, setDownloading] = useState<string | null>(null);

//   useEffect(() => {
//     const t = setTimeout(() => {
//       setDebouncedSearch(searchQuery);
//     }, 300);
//     return () => clearTimeout(t);
//   }, [searchQuery]);

//   const loadCategories = useCallback(async () => {
//     setLoadingCategories(true);
//     try {
//       const res = await apiFetch("/api/public/categories");
//       if (res.ok) {
//         const data = await res.json();
//         const list: any[] = Array.isArray(data)
//           ? data
//           : Array.isArray(data?.items)
//           ? data.items
//           : [];
//         setCategories(
//           list
//             .map((c: any) => ({
//               id: c.id ?? c._id ?? "",
//               name: c.name ?? "",
//             }))
//             .filter((c: Category) => c.id && c.name),
//         );
//       } else {
//         setCategories([]);
//       }
//     } catch {
//       setCategories([]);
//     } finally {
//       setLoadingCategories(false);
//     }
//   }, []);

//   const loadCourses = useCallback(async (sentinelCategoryId: string) => {
//     const categoryId =
//       sentinelCategoryId === SENTINEL_ALL_CATEGORIES ? "" : sentinelCategoryId;
//     if (!categoryId) {
//       setCourses([]);
//       return;
//     }
//     setLoadingCourses(true);
//     try {
//       let res = await apiFetch(`/api/courses?category_id=${encodeURIComponent(categoryId)}`);
//       if (!res.ok) {
//         res = await apiFetch(`/api/public/courses?category_id=${encodeURIComponent(categoryId)}`);
//       }
//       if (res.ok) {
//         const data = await res.json();
//         setCourses(Array.isArray(data) ? data : []);
//       } else {
//         setCourses([]);
//       }
//     } catch {
//       setCourses([]);
//     } finally {
//       setLoadingCourses(false);
//     }
//   }, []);

//   const loadStudents = useCallback(async () => {
//     setLoadingStudents(true);
//     try {
//       const params = new URLSearchParams();
//       if (debouncedSearch) params.set("search", debouncedSearch);
//       const realCategory =
//         selectedCategory === SENTINEL_ALL_CATEGORIES ? "" : selectedCategory;
//       const realCourse = selectedCourse === SENTINEL_ALL_COURSES ? "" : selectedCourse;
//       if (realCategory) params.set("categoryId", realCategory);
//       if (realCourse) params.set("courseId", realCourse);
//       const qs = params.toString();
//       const res = await apiFetch(`/api/admin/marksheets/eligible${qs ? `?${qs}` : ""}`);
//       if (res.ok) {
//         const data = await res.json();
//         setStudents(Array.isArray(data) ? data : []);
//       } else {
//         setStudents([]);
//       }
//     } catch {
//       setStudents([]);
//     } finally {
//       setLoadingStudents(false);
//     }
//   }, [debouncedSearch, selectedCategory, selectedCourse]);

//   useEffect(() => {
//     void loadCategories();
//   }, [loadCategories]);

//   useEffect(() => {
//     const realCategory =
//       selectedCategory === SENTINEL_ALL_CATEGORIES ? "" : selectedCategory;
//     if (realCategory) {
//       void loadCourses(selectedCategory);
//     } else {
//       setCourses([]);
//     }
//     setSelectedCourse("");
//   }, [selectedCategory, loadCourses]);

//   useEffect(() => {
//     void loadStudents();
//   }, [loadStudents]);

//   const actionKey = (sid: string, kind: string, attempt: number) =>
//     `${sid}::${kind}::${attempt}`;

//   const setGenerating = (sid: string, kind: string, attempt: number, val: boolean) => {
//     setGeneratingMap((prev) => ({
//       ...prev,
//       [actionKey(sid, kind, attempt)]: val,
//     }));
//   };

//   const handleDownloadExisting = async (docId: any, kind: "certificate" | "marksheet") => {
//     const id = normalizeId(docId);
//     if (!id) return;
//     setDownloading(id);
//     try {
//       const token = sessionStorage.getItem("token");
//       const url =
//         kind === "marksheet"
//           ? apiUrl(`/marksheets/${id}/download`)
//           : apiUrl(`/certificates/download/${id}`);

//       // #region debug-point A:frontend-existing-download
//       await debugReport(
//         "A",
//         "src/pages/GenerateCertificatesPage.tsx:239",
//         "[DEBUG] Existing document download triggered from Generate Certificates page",
//         {
//           action: "download-existing",
//           kind,
//           docId: id,
//           requestUrl: url,
//         },
//       );
//       // #endregion

//       const res = await fetch(url, {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       if (res.ok) {
//         const buf = await res.arrayBuffer();
//         const bytes = new Uint8Array(buf);
//         const head = bytes.slice(0, Math.min(32, bytes.length));
//         const tail = bytes.slice(Math.max(0, bytes.length - 32));
//         const sha256 = await sha256Hex(buf);
//         // #region debug-point B:frontend-existing-response
//         await debugReport(
//           "B",
//           "src/pages/GenerateCertificatesPage.tsx:259",
//           "[DEBUG] Existing document download response received on Generate Certificates page",
//           {
//             action: "download-existing",
//             kind,
//             docId: id,
//             finalUrl: res.url,
//             status: res.status,
//             contentType: res.headers.get("content-type"),
//             contentDisposition: res.headers.get("content-disposition"),
//             contentLength: res.headers.get("content-length"),
//             actualByteLength: bytes.length,
//             sha256,
//             first32Hex: hexSlice(head),
//             last32Hex: hexSlice(tail),
//           },
//         );
//         // #endregion
//         const blob = new Blob([buf], { type: "application/pdf" });
//         const blobUrl = window.URL.createObjectURL(blob);
//         const a = document.createElement("a");
//         a.href = blobUrl;
//         a.download = kind === "marksheet" ? `Marksheet_${id}.pdf` : `Certificate_${id}.pdf`;
//         document.body.appendChild(a);
//         a.click();
//         window.URL.revokeObjectURL(blobUrl);
//         document.body.removeChild(a);
//       } else {
//         let msg = "Failed to download";
//         let bodyPreview = "";
//         try {
//           const data = await res.json();
//           msg = data?.message || msg;
//           bodyPreview = JSON.stringify(data).slice(0, 500);
//         } catch {
//           // ignore
//         }
//         // #region debug-point B:frontend-existing-response
//         await debugReport(
//           "B",
//           "src/pages/GenerateCertificatesPage.tsx:289",
//           "[DEBUG] Existing document download failed on Generate Certificates page",
//           {
//             action: "download-existing",
//             kind,
//             docId: id,
//             finalUrl: res.url,
//             status: res.status,
//             contentType: res.headers.get("content-type"),
//             contentDisposition: res.headers.get("content-disposition"),
//             contentLength: res.headers.get("content-length"),
//             bodyPreview,
//           },
//         );
//         // #endregion
//         toast.error(`${kind === "marksheet" ? "Marksheet" : "Certificate"}: ${msg}`);
//       }
//     } catch {
//       // #region debug-point B:frontend-existing-response
//       await debugReport(
//         "B",
//         "src/pages/GenerateCertificatesPage.tsx:307",
//         "[DEBUG] Existing document download threw before response handling",
//         {
//           action: "download-existing",
//           kind,
//           docId: id,
//         },
//       );
//       // #endregion
//       toast.error("Download failed");
//     } finally {
//       setDownloading(null);
//     }
//   };

//   const handleGenerateAndDownload = async (
//     sid: string,
//     kind: "certificate" | "marksheet",
//     attempt: number,
//   ) => {
//     const studentId = normalizeId(sid);
//     if (!studentId) return;
//     const key = actionKey(studentId, kind, attempt);
//     setGenerating(studentId, kind, attempt, true);
//     try {
//       const token = sessionStorage.getItem("token");
//       const qs = new URLSearchParams();
//       qs.set("kind", kind);
//       qs.set("attempt", String(attempt));
//       const url = apiUrl(`/admin/students/${studentId}/documents/download?${qs.toString()}`);

//       // #region debug-point C:frontend-generate-download
//       await debugReport(
//         "C",
//         "src/pages/GenerateCertificatesPage.tsx:336",
//         "[DEBUG] Generate + download triggered from Generate Certificates page",
//         {
//           action: "generate-download",
//           kind,
//           studentId,
//           attempt,
//           requestUrl: url,
//         },
//       );
//       // #endregion

//       // fetch follows same-origin 3xx redirects automatically and preserves headers
//       const res = await fetch(url, {
//         headers: { Authorization: `Bearer ${token}` },
//         redirect: "follow",
//       });

//       if (res.ok) {
//         const buf = await res.arrayBuffer();
//         const bytes = new Uint8Array(buf);
//         const head = bytes.slice(0, Math.min(32, bytes.length));
//         const tail = bytes.slice(Math.max(0, bytes.length - 32));
//         const sha256 = await sha256Hex(buf);
//         // #region debug-point E:frontend-generate-response
//         await debugReport(
//           "E",
//           "src/pages/GenerateCertificatesPage.tsx:358",
//           "[DEBUG] Generate + download response received on Generate Certificates page",
//           {
//             action: "generate-download",
//             kind,
//             studentId,
//             attempt,
//             finalUrl: res.url,
//             status: res.status,
//             contentType: res.headers.get("content-type"),
//             contentDisposition: res.headers.get("content-disposition"),
//             contentLength: res.headers.get("content-length"),
//             actualByteLength: bytes.length,
//             sha256,
//             first32Hex: hexSlice(head),
//             last32Hex: hexSlice(tail),
//           },
//         );
//         // #endregion
//         const blob = new Blob([buf], { type: "application/pdf" });
//         const blobUrl = window.URL.createObjectURL(blob);
//         const a = document.createElement("a");
//         a.href = blobUrl;
//         const stamp = new Date().toISOString().slice(0, 10);
//         a.download =
//           kind === "marksheet" ? `Marksheet_${studentId}_${stamp}.pdf` : `Certificate_${studentId}_${stamp}.pdf`;
//         document.body.appendChild(a);
//         a.click();
//         window.URL.revokeObjectURL(blobUrl);
//         document.body.removeChild(a);
//         // Reload the list to pick up newly-generated document IDs
//         void loadStudents();
//       } else {
//         let msg = "Failed to generate";
//         let bodyPreview = "";
//         try {
//           const data = await res.json();
//           msg = data?.message || msg;
//           bodyPreview = JSON.stringify(data).slice(0, 500);
//         } catch {
//           // ignore
//         }
//         // #region debug-point E:frontend-generate-response
//         await debugReport(
//           "E",
//           "src/pages/GenerateCertificatesPage.tsx:390",
//           "[DEBUG] Generate + download failed on Generate Certificates page",
//           {
//             action: "generate-download",
//             kind,
//             studentId,
//             attempt,
//             finalUrl: res.url,
//             status: res.status,
//             contentType: res.headers.get("content-type"),
//             contentDisposition: res.headers.get("content-disposition"),
//             contentLength: res.headers.get("content-length"),
//             bodyPreview,
//           },
//         );
//         // #endregion
//         toast.error(`${kind === "marksheet" ? "Marksheet" : "Certificate"}: ${msg}`);
//       }
//     } catch {
//       // #region debug-point E:frontend-generate-response
//       await debugReport(
//         "E",
//         "src/pages/GenerateCertificatesPage.tsx:409",
//         "[DEBUG] Generate + download threw before response handling",
//         {
//           action: "generate-download",
//           kind,
//           studentId,
//           attempt,
//         },
//       );
//       // #endregion
//       toast.error("Generate + download failed");
//     } finally {
//       setGenerating(studentId, kind, attempt, false);
//     }
//   };

//   const isLoading = loadingStudents;

//   return (
//     <DashboardLayout>
//       <div className="p-6 max-w-7xl mx-auto space-y-6">
//         <div>
//           <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary/70 mb-1">
//             Attachments
//           </p>
//           <h1 className="font-heading font-extrabold text-3xl uppercase tracking-tight text-foreground">
//             Generate Certificates &amp; Marksheets
//           </h1>
//           <p className="text-muted-foreground text-sm font-medium mt-1 max-w-xl">
//             Browse students and download their generated certificates and marksheets.
//             Only students with submitted marks (center entry or online exam) are listed.
//           </p>
//         </div>

//         <Card className="rounded-none border-border shadow-sm bg-muted/20">
//           <CardContent className="p-6">
//             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
//               <div className="space-y-1.5 lg:col-span-2">
//                 <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
//                   Search
//                 </label>
//                 <div className="relative">
//                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
//                   <Input
//                     placeholder="Search by name, father, enrollment, center..."
//                     className="pl-10 rounded-none border-border bg-background"
//                     value={searchQuery}
//                     onChange={(e) => setSearchQuery(e.target.value)}
//                   />
//                 </div>
//               </div>

//               <div className="space-y-1.5">
//                 <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
//                   Category
//                 </label>
//                 <Select
//                   value={selectedCategory || undefined}
//                   onValueChange={(v) => setSelectedCategory(v || "")}
//                   disabled={loadingCategories}
//                 >
//                   <SelectTrigger className="rounded-none border-border bg-background">
//                     <SelectValue placeholder={loadingCategories ? "Loading..." : "All Categories"} />
//                   </SelectTrigger>
//                   <SelectContent>
//                     <SelectItem value={SENTINEL_ALL_CATEGORIES}>All Categories</SelectItem>
//                     {categories
//                       .filter((c) => c.id && c.name)
//                       .map((c) => (
//                         <SelectItem key={c.id} value={c.id}>
//                           {c.name}
//                         </SelectItem>
//                       ))}
//                   </SelectContent>
//                 </Select>
//               </div>

//               {(selectedCategory && selectedCategory !== SENTINEL_ALL_CATEGORIES) && (
//                 <div className="space-y-1.5">
//                   <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
//                     Course
//                   </label>
//                   <Select
//                     value={selectedCourse || undefined}
//                     onValueChange={(v) => setSelectedCourse(v || "")}
//                     disabled={loadingCourses}
//                   >
//                     <SelectTrigger className="rounded-none border-border bg-background">
//                       <SelectValue placeholder={loadingCourses ? "Loading..." : "All Courses"} />
//                     </SelectTrigger>
//                     <SelectContent>
//                       <SelectItem value={SENTINEL_ALL_COURSES}>All Courses in Category</SelectItem>
//                       {courses
//                         .filter((c) => c.id && c.course_name)
//                         .map((c) => (
//                           <SelectItem key={c.id} value={c.id}>
//                             {c.course_name}
//                           </SelectItem>
//                         ))}
//                     </SelectContent>
//                   </Select>
//                 </div>
//               )}
//             </div>
//           </CardContent>
//         </Card>

//         <Card className="rounded-none border-border shadow-md overflow-hidden">
//           <CardHeader className="bg-muted/30 border-b border-border py-4">
//             <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
//               <Award className="w-4 h-4 text-primary" />
//               Students &amp; Documents
//               <span className="font-mono font-normal normal-case text-[10px] text-muted-foreground ml-2">
//                 {students.length} result{students.length === 1 ? "" : "s"}
//               </span>
//             </CardTitle>
//           </CardHeader>
//           <CardContent className="p-0">
//             <div className="overflow-x-auto">
//               <table className="w-full text-left border-collapse">
//                 <thead>
//                   <tr className="text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-muted/50">
//                     <th className="px-6 py-3 border-b border-border w-16">S.No.</th>
//                     <th className="px-6 py-3 border-b border-border">Name</th>
//                     <th className="px-6 py-3 border-b border-border">Father Name</th>
//                     <th className="px-6 py-3 border-b border-border">Enrollment No.</th>
//                     <th className="px-6 py-3 border-b border-border">Course Name</th>
//                     <th className="px-6 py-3 border-b border-border">Center Name</th>
//                     <th className="px-6 py-3 border-b border-border min-w-[320px]">Action</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {isLoading ? (
//                     <tr>
//                       <td colSpan={7} className="px-6 py-12 text-center">
//                         <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
//                         <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
//                           Loading...
//                         </span>
//                       </td>
//                     </tr>
//                   ) : students.length === 0 ? (
//                     <tr>
//                       <td colSpan={7} className="px-6 py-12 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">
//                         No eligible students found. Students appear here once center marks are submitted or their online exam is evaluated.
//                       </td>
//                     </tr>
//                   ) : (
//                     students.map((student, idx) => {
//                       const sid = normalizeId(student.id) || normalizeId(student.student_id);
//                       const displayName =
//                         student.full_name?.trim() ||
//                         student.student_name?.trim() ||
//                         student.registration_number ||
//                         "—";
//                       const father = student.father_name;
//                       const enrollment = student.enrollment_number;
//                       const course =
//                         student.course_name?.trim() || student.course?.trim() || "—";
//                       const center = student.center_name;

//                       return (
//                         <tr key={sid || idx} className="hover:bg-primary/5 transition-colors border-b border-border align-top">
//                           <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{idx + 1}</td>
//                           <td className="px-6 py-4 font-bold break-words max-w-[200px]">{displayName}</td>
//                           <td className="px-6 py-4 break-words max-w-[200px]">{father || "—"}</td>
//                           <td className="px-6 py-4 text-xs font-mono">
//                             {enrollment || student.registration_number || "—"}
//                           </td>
//                           <td className="px-6 py-4 break-words max-w-[220px]">{course}</td>
//                           <td className="px-6 py-4 text-xs break-words max-w-[200px]">{center || "—"}</td>
//                           <td className="px-6 py-4">
//                             {student.attempts.length === 0 ? (
//                               <span className="text-xs text-muted-foreground italic">
//                                 No attempts available
//                               </span>
//                             ) : (
//                               <div className="flex flex-col gap-3">
//                                 {student.attempts.map((a) => {
//                                   const marksheetId = normalizeId(a.marksheet_id);
//                                   const certificateId = normalizeId(a.certificate_id);
//                                   const isGenMs = generatingMap[actionKey(sid, "marksheet", a.attempt_number)];
//                                   const isGenCert = generatingMap[actionKey(sid, "certificate", a.attempt_number)];

//                                   return (
//                                     <div key={a.attempt_number} className="space-y-2">
//                                       <div className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
//                                         Attempt {a.attempt_number}
//                                       </div>
//                                       <div className="flex flex-wrap gap-2">
//                                         {marksheetId ? (
//                                           <Button
//                                             type="button"
//                                             size="sm"
//                                             className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-none"
//                                             onClick={() => handleDownloadExisting(marksheetId, "marksheet")}
//                                             disabled={downloading === marksheetId}
//                                           >
//                                             {downloading === marksheetId ? (
//                                               <Loader2 className="w-3 h-3 mr-1 animate-spin" />
//                                             ) : (
//                                               <FileSpreadsheet className="w-3 h-3 mr-1" />
//                                             )}
//                                             Download Marksheet
//                                           </Button>
//                                         ) : (
//                                           <Button
//                                             type="button"
//                                             size="sm"
//                                             className="h-8 px-3 bg-blue-500 hover:bg-blue-600 text-white rounded-none"
//                                             onClick={() =>
//                                               handleGenerateAndDownload(sid, "marksheet", a.attempt_number)
//                                             }
//                                             disabled={isGenMs}
//                                           >
//                                             {isGenMs ? (
//                                               <>
//                                                 <Loader2 className="w-3 h-3 mr-1 animate-spin" />
//                                                 Generating…
//                                               </>
//                                             ) : (
//                                               <>
//                                                 <Download className="w-3 h-3 mr-1" />
//                                                 Generate Marksheet
//                                               </>
//                                             )}
//                                           </Button>
//                                         )}

//                                         {certificateId ? (
//                                           <Button
//                                             type="button"
//                                             size="sm"
//                                             className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-none"
//                                             onClick={() => handleDownloadExisting(certificateId, "certificate")}
//                                             disabled={downloading === certificateId}
//                                           >
//                                             {downloading === certificateId ? (
//                                               <Loader2 className="w-3 h-3 mr-1 animate-spin" />
//                                             ) : (
//                                               <Award className="w-3 h-3 mr-1" />
//                                             )}
//                                             Download Certificate
//                                           </Button>
//                                         ) : (
//                                           <Button
//                                             type="button"
//                                             size="sm"
//                                             className="h-8 px-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-none"
//                                             onClick={() =>
//                                               handleGenerateAndDownload(sid, "certificate", a.attempt_number)
//                                             }
//                                             disabled={isGenCert}
//                                           >
//                                             {isGenCert ? (
//                                               <>
//                                                 <Loader2 className="w-3 h-3 mr-1 animate-spin" />
//                                                 Generating…
//                                               </>
//                                             ) : (
//                                               <>
//                                                 <FileBadge className="w-3 h-3 mr-1" />
//                                                 Generate Certificate
//                                               </>
//                                             )}
//                                           </Button>
//                                         )}
//                                       </div>
//                                     </div>
//                                   );
//                                 })}
//                               </div>
//                             )}
//                           </td>
//                         </tr>
//                       );
//                     })
//                   )}
//                 </tbody>
//               </table>
//             </div>
//           </CardContent>
//         </Card>
//       </div>
//     </DashboardLayout>
//   );
// }
// import { useEffect, useState, useCallback } from "react";
// import DashboardLayout from "@/components/DashboardLayout";
// import { apiFetch, apiUrl } from "@/lib/api";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { Search, Download, Award, Loader2, FileSpreadsheet, FileBadge } from "lucide-react";
// import { toast } from "sonner";

// interface Category {
//   id: string;
//   name: string;
// }

// interface CourseItem {
//   id: string;
//   course_name: string;
// }

// interface StudentAttempt {
//   attempt_number: number;
//   marksheet_id?: string | null;
//   certificate_id?: string | null;
// }

// interface EligibleStudent {
//   id: string;
//   student_id: string;
//   student_name: string;
//   full_name: string;
//   registration_number: string;
//   father_name?: string | null;
//   enrollment_number?: string | null;
//   course: string;
//   course_name: string;
//   center_name?: string | null;
//   attempts: StudentAttempt[];
// }

// function normalizeId(v: any): string {
//   if (v == null) return "";
//   if (typeof v === "string") {
//     const t = v.trim();
//     return /^[a-f0-9]{24}$/i.test(t) ? t.toLowerCase() : t;
//   }
//   if (typeof v === "object" && v !== null) {
//     if ("$oid" in v && typeof (v as any).$oid === "string") {
//       return normalizeId((v as any).$oid);
//     }
//     if ("id" in v) return normalizeId((v as any).id);
//     if ("_id" in v) return normalizeId((v as any)._id);
//   }
//   return String(v ?? "").toLowerCase();
// }

// const SENTINEL_ALL_CATEGORIES = "__all_categories__";
// const SENTINEL_ALL_COURSES = "__all_courses__";

// export default function GenerateCertificatesPage() {
//   const [searchQuery, setSearchQuery] = useState("");
//   const [debouncedSearch, setDebouncedSearch] = useState("");
//   const [selectedCategory, setSelectedCategory] = useState<string>("");
//   const [selectedCourse, setSelectedCourse] = useState<string>("");

//   const [categories, setCategories] = useState<Category[]>([]);
//   const [courses, setCourses] = useState<CourseItem[]>([]);
//   const [students, setStudents] = useState<EligibleStudent[]>([]);

//   const [loadingStudents, setLoadingStudents] = useState(false);
//   const [loadingCategories, setLoadingCategories] = useState(false);
//   const [loadingCourses, setLoadingCourses] = useState(false);
//   const [generatingMap, setGeneratingMap] = useState<Record<string, boolean>>({});
//   const [downloading, setDownloading] = useState<string | null>(null);

//   useEffect(() => {
//     const t = setTimeout(() => {
//       setDebouncedSearch(searchQuery);
//     }, 300);
//     return () => clearTimeout(t);
//   }, [searchQuery]);

//   const loadCategories = useCallback(async () => {
//     setLoadingCategories(true);
//     try {
//       const res = await apiFetch("/api/public/categories");
//       if (res.ok) {
//         const data = await res.json();
//         const list: any[] = Array.isArray(data)
//           ? data
//           : Array.isArray(data?.items)
//           ? data.items
//           : [];
//         setCategories(
//           list
//             .map((c: any) => ({
//               id: c.id ?? c._id ?? "",
//               name: c.name ?? "",
//             }))
//             .filter((c: Category) => c.id && c.name),
//         );
//       } else {
//         setCategories([]);
//       }
//     } catch {
//       setCategories([]);
//     } finally {
//       setLoadingCategories(false);
//     }
//   }, []);

//   const loadCourses = useCallback(async (sentinelCategoryId: string) => {
//     const categoryId =
//       sentinelCategoryId === SENTINEL_ALL_CATEGORIES ? "" : sentinelCategoryId;
//     if (!categoryId) {
//       setCourses([]);
//       return;
//     }
//     setLoadingCourses(true);
//     try {
//       let res = await apiFetch(`/api/courses?category_id=${encodeURIComponent(categoryId)}`);
//       if (!res.ok) {
//         res = await apiFetch(`/api/public/courses?category_id=${encodeURIComponent(categoryId)}`);
//       }
//       if (res.ok) {
//         const data = await res.json();
//         setCourses(Array.isArray(data) ? data : []);
//       } else {
//         setCourses([]);
//       }
//     } catch {
//       setCourses([]);
//     } finally {
//       setLoadingCourses(false);
//     }
//   }, []);

//   const loadStudents = useCallback(async () => {
//     setLoadingStudents(true);
//     try {
//       const params = new URLSearchParams();
//       if (debouncedSearch) params.set("search", debouncedSearch);
//       const realCategory =
//         selectedCategory === SENTINEL_ALL_CATEGORIES ? "" : selectedCategory;
//       const realCourse = selectedCourse === SENTINEL_ALL_COURSES ? "" : selectedCourse;
//       if (realCategory) params.set("categoryId", realCategory);
//       if (realCourse) params.set("courseId", realCourse);
//       const qs = params.toString();
//       const res = await apiFetch(`/api/admin/marksheets/eligible${qs ? `?${qs}` : ""}`);
//       if (res.ok) {
//         const data = await res.json();
//         setStudents(Array.isArray(data) ? data : []);
//       } else {
//         setStudents([]);
//       }
//     } catch {
//       setStudents([]);
//     } finally {
//       setLoadingStudents(false);
//     }
//   }, [debouncedSearch, selectedCategory, selectedCourse]);

//   useEffect(() => {
//     void loadCategories();
//   }, [loadCategories]);

//   useEffect(() => {
//     const realCategory =
//       selectedCategory === SENTINEL_ALL_CATEGORIES ? "" : selectedCategory;
//     if (realCategory) {
//       void loadCourses(selectedCategory);
//     } else {
//       setCourses([]);
//     }
//     setSelectedCourse("");
//   }, [selectedCategory, loadCourses]);

//   useEffect(() => {
//     void loadStudents();
//   }, [loadStudents]);

//   const actionKey = (sid: string, kind: string, attempt: number) =>
//     `${sid}::${kind}::${attempt}`;

//   const setGenerating = (sid: string, kind: string, attempt: number, val: boolean) => {
//     setGeneratingMap((prev) => ({
//       ...prev,
//       [actionKey(sid, kind, attempt)]: val,
//     }));
//   };

//   const triggerFileSave = (blob: Blob, filename: string) => {
//     const blobUrl = window.URL.createObjectURL(blob);
//     const a = document.createElement("a");
//     a.href = blobUrl;
//     a.download = filename;
//     document.body.appendChild(a);
//     a.click();
//     window.URL.revokeObjectURL(blobUrl);
//     document.body.removeChild(a);
//   };

//   const handleDownloadExisting = async (docId: any, kind: "certificate" | "marksheet") => {
//     const id = normalizeId(docId);
//     if (!id) return;
//     setDownloading(id);
//     try {
//       const token = sessionStorage.getItem("token");
//       const url =
//         kind === "marksheet"
//           ? apiUrl(`/marksheets/${id}/download`)
//           : apiUrl(`/certificates/download/${id}`);

//       const res = await fetch(url, {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       if (res.ok) {
//         const blob = await res.blob();
//         triggerFileSave(blob, kind === "marksheet" ? `Marksheet_${id}.pdf` : `Certificate_${id}.pdf`);
//       } else {
//         let msg = "Failed to download";
//         try {
//           const data = await res.json();
//           msg = data?.message || msg;
//         } catch {
//           // ignore
//         }
//         toast.error(`${kind === "marksheet" ? "Marksheet" : "Certificate"}: ${msg}`);
//       }
//     } catch {
//       toast.error("Download failed");
//     } finally {
//       setDownloading(null);
//     }
//   };

//   const handleGenerateAndDownload = async (
//     sid: string,
//     kind: "certificate" | "marksheet",
//     attempt: number,
//   ) => {
//     const studentId = normalizeId(sid);
//     if (!studentId) return;
//     setGenerating(studentId, kind, attempt, true);
//     try {
//       const token = sessionStorage.getItem("token");
//       const qs = new URLSearchParams();
//       qs.set("kind", kind);
//       qs.set("attempt", String(attempt));
//       const url = apiUrl(`/admin/students/${studentId}/documents/download?${qs.toString()}`);

//       const res = await fetch(url, {
//         headers: { Authorization: `Bearer ${token}` },
//         redirect: "follow",
//       });

//       if (res.ok) {
//         const blob = await res.blob();
//         const stamp = new Date().toISOString().slice(0, 10);
//         triggerFileSave(
//           blob,
//           kind === "marksheet"
//             ? `Marksheet_${studentId}_${stamp}.pdf`
//             : `Certificate_${studentId}_${stamp}.pdf`,
//         );
//         // Reload the list to pick up newly-generated document IDs
//         void loadStudents();
//       } else {
//         let msg = "Failed to generate";
//         try {
//           const data = await res.json();
//           msg = data?.message || msg;
//         } catch {
//           // ignore
//         }
//         toast.error(`${kind === "marksheet" ? "Marksheet" : "Certificate"}: ${msg}`);
//       }
//     } catch {
//       toast.error("Generate + download failed");
//     } finally {
//       setGenerating(studentId, kind, attempt, false);
//     }
//   };

//   const isLoading = loadingStudents;

//   return (
//     <DashboardLayout>
//       <div className="p-6 max-w-7xl mx-auto space-y-6">
//         <div>
//           <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary/70 mb-1">
//             Attachments
//           </p>
//           <h1 className="font-heading font-extrabold text-3xl uppercase tracking-tight text-foreground">
//             Generate Certificates &amp; Marksheets
//           </h1>
//           <p className="text-muted-foreground text-sm font-medium mt-1 max-w-xl">
//             Browse students and download their generated certificates and marksheets.
//             Only students with submitted marks (center entry or online exam) are listed.
//           </p>
//         </div>

//         <Card className="rounded-none border-border shadow-sm bg-muted/20">
//           <CardContent className="p-6">
//             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
//               <div className="space-y-1.5 lg:col-span-2">
//                 <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
//                   Search
//                 </label>
//                 <div className="relative">
//                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
//                   <Input
//                     placeholder="Search by name, father, enrollment, center..."
//                     className="pl-10 rounded-none border-border bg-background"
//                     value={searchQuery}
//                     onChange={(e) => setSearchQuery(e.target.value)}
//                   />
//                 </div>
//               </div>

//               <div className="space-y-1.5">
//                 <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
//                   Category
//                 </label>
//                 <Select
//                   value={selectedCategory || undefined}
//                   onValueChange={(v) => setSelectedCategory(v || "")}
//                   disabled={loadingCategories}
//                 >
//                   <SelectTrigger className="rounded-none border-border bg-background">
//                     <SelectValue placeholder={loadingCategories ? "Loading..." : "All Categories"} />
//                   </SelectTrigger>
//                   <SelectContent>
//                     <SelectItem value={SENTINEL_ALL_CATEGORIES}>All Categories</SelectItem>
//                     {categories
//                       .filter((c) => c.id && c.name)
//                       .map((c) => (
//                         <SelectItem key={c.id} value={c.id}>
//                           {c.name}
//                         </SelectItem>
//                       ))}
//                   </SelectContent>
//                 </Select>
//               </div>

//               {(selectedCategory && selectedCategory !== SENTINEL_ALL_CATEGORIES) && (
//                 <div className="space-y-1.5">
//                   <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
//                     Course
//                   </label>
//                   <Select
//                     value={selectedCourse || undefined}
//                     onValueChange={(v) => setSelectedCourse(v || "")}
//                     disabled={loadingCourses}
//                   >
//                     <SelectTrigger className="rounded-none border-border bg-background">
//                       <SelectValue placeholder={loadingCourses ? "Loading..." : "All Courses"} />
//                     </SelectTrigger>
//                     <SelectContent>
//                       <SelectItem value={SENTINEL_ALL_COURSES}>All Courses in Category</SelectItem>
//                       {courses
//                         .filter((c) => c.id && c.course_name)
//                         .map((c) => (
//                           <SelectItem key={c.id} value={c.id}>
//                             {c.course_name}
//                           </SelectItem>
//                         ))}
//                     </SelectContent>
//                   </Select>
//                 </div>
//               )}
//             </div>
//           </CardContent>
//         </Card>

//         <Card className="rounded-none border-border shadow-md overflow-hidden">
//           <CardHeader className="bg-muted/30 border-b border-border py-4">
//             <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
//               <Award className="w-4 h-4 text-primary" />
//               Students &amp; Documents
//               <span className="font-mono font-normal normal-case text-[10px] text-muted-foreground ml-2">
//                 {students.length} result{students.length === 1 ? "" : "s"}
//               </span>
//             </CardTitle>
//           </CardHeader>
//           <CardContent className="p-0">
//             <div className="overflow-x-auto">
//               <table className="w-full text-left border-collapse">
//                 <thead>
//                   <tr className="text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-muted/50">
//                     <th className="px-6 py-3 border-b border-border w-16">S.No.</th>
//                     <th className="px-6 py-3 border-b border-border">Name</th>
//                     <th className="px-6 py-3 border-b border-border">Father Name</th>
//                     <th className="px-6 py-3 border-b border-border">Enrollment No.</th>
//                     <th className="px-6 py-3 border-b border-border">Course Name</th>
//                     <th className="px-6 py-3 border-b border-border">Center Name</th>
//                     <th className="px-6 py-3 border-b border-border min-w-[320px]">Action</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {isLoading ? (
//                     <tr>
//                       <td colSpan={7} className="px-6 py-12 text-center">
//                         <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
//                         <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
//                           Loading...
//                         </span>
//                       </td>
//                     </tr>
//                   ) : students.length === 0 ? (
//                     <tr>
//                       <td colSpan={7} className="px-6 py-12 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">
//                         No eligible students found. Students appear here once center marks are submitted or their online exam is evaluated.
//                       </td>
//                     </tr>
//                   ) : (
//                     students.map((student, idx) => {
//                       const sid = normalizeId(student.id) || normalizeId(student.student_id);
//                       const displayName =
//                         student.full_name?.trim() ||
//                         student.student_name?.trim() ||
//                         student.registration_number ||
//                         "—";
//                       const father = student.father_name;
//                       const enrollment = student.enrollment_number;
//                       const course =
//                         student.course_name?.trim() || student.course?.trim() || "—";
//                       const center = student.center_name;

//                       return (
//                         <tr key={sid || idx} className="hover:bg-primary/5 transition-colors border-b border-border align-top">
//                           <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{idx + 1}</td>
//                           <td className="px-6 py-4 font-bold break-words max-w-[200px]">{displayName}</td>
//                           <td className="px-6 py-4 break-words max-w-[200px]">{father || "—"}</td>
//                           <td className="px-6 py-4 text-xs font-mono">
//                             {enrollment || student.registration_number || "—"}
//                           </td>
//                           <td className="px-6 py-4 break-words max-w-[220px]">{course}</td>
//                           <td className="px-6 py-4 text-xs break-words max-w-[200px]">{center || "—"}</td>
//                           <td className="px-6 py-4">
//                             {student.attempts.length === 0 ? (
//                               <span className="text-xs text-muted-foreground italic">
//                                 No attempts available
//                               </span>
//                             ) : (
//                               <div className="flex flex-col gap-3">
//                                 {student.attempts.map((a) => {
//                                   const marksheetId = normalizeId(a.marksheet_id);
//                                   const certificateId = normalizeId(a.certificate_id);
//                                   const isGenMs = generatingMap[actionKey(sid, "marksheet", a.attempt_number)];
//                                   const isGenCert = generatingMap[actionKey(sid, "certificate", a.attempt_number)];

//                                   return (
//                                     <div key={a.attempt_number} className="space-y-2">
//                                       <div className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
//                                         Attempt {a.attempt_number}
//                                       </div>
//                                       <div className="flex flex-wrap gap-2">
//                                         {marksheetId ? (
//                                           <Button
//                                             type="button"
//                                             size="sm"
//                                             className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-none"
//                                             onClick={() => handleDownloadExisting(marksheetId, "marksheet")}
//                                             disabled={downloading === marksheetId}
//                                           >
//                                             {downloading === marksheetId ? (
//                                               <Loader2 className="w-3 h-3 mr-1 animate-spin" />
//                                             ) : (
//                                               <FileSpreadsheet className="w-3 h-3 mr-1" />
//                                             )}
//                                             Download Marksheet
//                                           </Button>
//                                         ) : (
//                                           <Button
//                                             type="button"
//                                             size="sm"
//                                             className="h-8 px-3 bg-blue-500 hover:bg-blue-600 text-white rounded-none"
//                                             onClick={() =>
//                                               handleGenerateAndDownload(sid, "marksheet", a.attempt_number)
//                                             }
//                                             disabled={isGenMs}
//                                           >
//                                             {isGenMs ? (
//                                               <>
//                                                 <Loader2 className="w-3 h-3 mr-1 animate-spin" />
//                                                 Generating…
//                                               </>
//                                             ) : (
//                                               <>
//                                                 <Download className="w-3 h-3 mr-1" />
//                                                 Generate Marksheet
//                                               </>
//                                             )}
//                                           </Button>
//                                         )}

//                                         {certificateId ? (
//                                           <Button
//                                             type="button"
//                                             size="sm"
//                                             className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-none"
//                                             onClick={() => handleDownloadExisting(certificateId, "certificate")}
//                                             disabled={downloading === certificateId}
//                                           >
//                                             {downloading === certificateId ? (
//                                               <Loader2 className="w-3 h-3 mr-1 animate-spin" />
//                                             ) : (
//                                               <Award className="w-3 h-3 mr-1" />
//                                             )}
//                                             Download Certificate
//                                           </Button>
//                                         ) : (
//                                           <Button
//                                             type="button"
//                                             size="sm"
//                                             className="h-8 px-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-none"
//                                             onClick={() =>
//                                               handleGenerateAndDownload(sid, "certificate", a.attempt_number)
//                                             }
//                                             disabled={isGenCert}
//                                           >
//                                             {isGenCert ? (
//                                               <>
//                                                 <Loader2 className="w-3 h-3 mr-1 animate-spin" />
//                                                 Generating…
//                                               </>
//                                             ) : (
//                                               <>
//                                                 <FileBadge className="w-3 h-3 mr-1" />
//                                                 Generate Certificate
//                                               </>
//                                             )}
//                                           </Button>
//                                         )}
//                                       </div>
//                                     </div>
//                                   );
//                                 })}
//                               </div>
//                             )}
//                           </td>
//                         </tr>
//                       );
//                     })
//                   )}
//                 </tbody>
//               </table>
//             </div>
//           </CardContent>
//         </Card>
//       </div>
//     </DashboardLayout>
//   );
// }

// import { useEffect, useState, useCallback } from "react";
// import DashboardLayout from "@/components/DashboardLayout";
// import { apiFetch, apiUrl } from "@/lib/api";
// import {
//   Card,
//   CardContent,
//   CardHeader,
//   CardTitle,
// } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import {
//   Search,
//   Download,
//   Award,
//   Loader2,
//   FileSpreadsheet,
//   FileBadge,
// } from "lucide-react";
// import { toast } from "sonner";

// interface Category {
//   id: string;
//   name: string;
// }

// interface CourseItem {
//   id: string;
//   course_name: string;
// }

// interface StudentAttempt {
//   attempt_number: number;
//   marksheet_id?: string | null;
//   certificate_id?: string | null;
// }

// interface EligibleStudent {
//   id: string;
//   student_id: string;
//   student_name: string;
//   full_name: string;
//   registration_number: string;
//   father_name?: string | null;
//   enrollment_number?: string | null;
//   course: string;
//   course_name: string;
//   center_name?: string | null;
//   attempts: StudentAttempt[];
// }

// function normalizeId(v: any): string {
//   if (v == null) return "";

//   if (typeof v === "string") {
//     const t = v.trim();

//     return /^[a-f0-9]{24}$/i.test(t)
//       ? t.toLowerCase()
//       : t;
//   }

//   if (typeof v === "object" && v !== null) {
//     if (
//       "$oid" in v &&
//       typeof (v as any).$oid === "string"
//     ) {
//       return normalizeId((v as any).$oid);
//     }

//     if ("id" in v) {
//       return normalizeId((v as any).id);
//     }

//     if ("_id" in v) {
//       return normalizeId((v as any)._id);
//     }
//   }

//   return String(v ?? "").toLowerCase();
// }

// const SENTINEL_ALL_CATEGORIES = "__all_categories__";
// const SENTINEL_ALL_COURSES = "__all_courses__";

// export default function GenerateCertificatesPage() {
//   const [searchQuery, setSearchQuery] = useState("");
//   const [debouncedSearch, setDebouncedSearch] = useState("");

//   const [selectedCategory, setSelectedCategory] =
//     useState<string>("");

//   const [selectedCourse, setSelectedCourse] =
//     useState<string>("");

//   const [categories, setCategories] =
//     useState<Category[]>([]);

//   const [courses, setCourses] =
//     useState<CourseItem[]>([]);

//   const [students, setStudents] =
//     useState<EligibleStudent[]>([]);

//   const [loadingStudents, setLoadingStudents] =
//     useState(false);

//   const [loadingCategories, setLoadingCategories] =
//     useState(false);

//   const [loadingCourses, setLoadingCourses] =
//     useState(false);

//   const [generatingMap, setGeneratingMap] =
//     useState<Record<string, boolean>>({});

//   const [downloading, setDownloading] =
//     useState<string | null>(null);

//   // =========================================================
//   // Debounce search
//   // =========================================================

//   useEffect(() => {
//     const timer = setTimeout(() => {
//       setDebouncedSearch(searchQuery);
//     }, 300);

//     return () => clearTimeout(timer);
//   }, [searchQuery]);

//   // =========================================================
//   // Load categories
//   // =========================================================

//   const loadCategories = useCallback(async () => {
//     setLoadingCategories(true);

//     try {
//       const res = await apiFetch(
//         "/api/public/categories"
//       );

//       if (!res.ok) {
//         setCategories([]);
//         return;
//       }

//       const data = await res.json();

//       const list: any[] = Array.isArray(data)
//         ? data
//         : Array.isArray(data?.items)
//         ? data.items
//         : [];

//       setCategories(
//         list
//           .map((c: any) => ({
//             id: c.id ?? c._id ?? "",
//             name: c.name ?? "",
//           }))
//           .filter(
//             (c: Category) =>
//               c.id && c.name
//           )
//       );
//     } catch (error) {
//       console.error(
//         "Failed to load categories:",
//         error
//       );

//       setCategories([]);
//     } finally {
//       setLoadingCategories(false);
//     }
//   }, []);

//   // =========================================================
//   // Load courses
//   // =========================================================

//   const loadCourses = useCallback(
//     async (sentinelCategoryId: string) => {
//       const categoryId =
//         sentinelCategoryId ===
//         SENTINEL_ALL_CATEGORIES
//           ? ""
//           : sentinelCategoryId;

//       if (!categoryId) {
//         setCourses([]);
//         return;
//       }

//       setLoadingCourses(true);

//       try {
//         let res = await apiFetch(
//           `/api/courses?category_id=${encodeURIComponent(
//             categoryId
//           )}`
//         );

//         if (!res.ok) {
//           res = await apiFetch(
//             `/api/public/courses?category_id=${encodeURIComponent(
//               categoryId
//             )}`
//           );
//         }

//         if (!res.ok) {
//           setCourses([]);
//           return;
//         }

//         const data = await res.json();

//         setCourses(
//           Array.isArray(data)
//             ? data
//             : []
//         );
//       } catch (error) {
//         console.error(
//           "Failed to load courses:",
//           error
//         );

//         setCourses([]);
//       } finally {
//         setLoadingCourses(false);
//       }
//     },
//     []
//   );

//   // =========================================================
//   // Load eligible students
//   // =========================================================

//   const loadStudents = useCallback(async () => {
//     setLoadingStudents(true);

//     try {
//       const params = new URLSearchParams();

//       if (debouncedSearch) {
//         params.set(
//           "search",
//           debouncedSearch
//         );
//       }

//       const realCategory =
//         selectedCategory ===
//         SENTINEL_ALL_CATEGORIES
//           ? ""
//           : selectedCategory;

//       const realCourse =
//         selectedCourse ===
//         SENTINEL_ALL_COURSES
//           ? ""
//           : selectedCourse;

//       if (realCategory) {
//         params.set(
//           "categoryId",
//           realCategory
//         );
//       }

//       if (realCourse) {
//         params.set(
//           "courseId",
//           realCourse
//         );
//       }

//       const queryString =
//         params.toString();

//       const url =
//         `/api/admin/marksheets/eligible${
//           queryString
//             ? `?${queryString}`
//             : ""
//         }`;

//       const res = await apiFetch(url);

//       if (!res.ok) {
//         setStudents([]);
//         return;
//       }

//       const data = await res.json();

//       setStudents(
//         Array.isArray(data)
//           ? data
//           : []
//       );
//     } catch (error) {
//       console.error(
//         "Failed to load students:",
//         error
//       );

//       setStudents([]);
//     } finally {
//       setLoadingStudents(false);
//     }
//   }, [
//     debouncedSearch,
//     selectedCategory,
//     selectedCourse,
//   ]);

//   // =========================================================
//   // Initial categories
//   // =========================================================

//   useEffect(() => {
//     void loadCategories();
//   }, [loadCategories]);

//   // =========================================================
//   // Category changed
//   // =========================================================

//   useEffect(() => {
//     const realCategory =
//       selectedCategory ===
//       SENTINEL_ALL_CATEGORIES
//         ? ""
//         : selectedCategory;

//     if (realCategory) {
//       void loadCourses(
//         selectedCategory
//       );
//     } else {
//       setCourses([]);
//     }

//     setSelectedCourse("");
//   }, [
//     selectedCategory,
//     loadCourses,
//   ]);

//   // =========================================================
//   // Reload students
//   // =========================================================

//   useEffect(() => {
//     void loadStudents();
//   }, [loadStudents]);

//   // =========================================================
//   // Action key
//   // =========================================================

//   const actionKey = (
//     sid: string,
//     kind: string,
//     attempt: number
//   ) => {
//     return `${sid}::${kind}::${attempt}`;
//   };

//   // =========================================================
//   // Generation state
//   // =========================================================

//   const setGenerating = (
//     sid: string,
//     kind: string,
//     attempt: number,
//     value: boolean
//   ) => {
//     setGeneratingMap((prev) => ({
//       ...prev,
//       [actionKey(
//         sid,
//         kind,
//         attempt
//       )]: value,
//     }));
//   };

//   // =========================================================
//   // Save blob to file
//   // =========================================================

//   const triggerFileSave = (
//     blob: Blob,
//     filename: string
//   ) => {
//     const blobUrl =
//       window.URL.createObjectURL(blob);

//     const anchor =
//       document.createElement("a");

//     anchor.href = blobUrl;
//     anchor.download = filename;

//     document.body.appendChild(anchor);

//     anchor.click();

//     document.body.removeChild(anchor);

//     window.URL.revokeObjectURL(blobUrl);
//   };

//   // =========================================================
//   // DOWNLOAD EXISTING DOCUMENT
//   //
//   // PUBLIC ENDPOINT
//   // NO JWT
//   // NO Authorization HEADER
//   //
//   // GET /api/certificates/download/:id
//   // =========================================================

//   const handleDownloadExisting = async (
//     docId: any,
//     kind: "certificate" | "marksheet"
//   ) => {
//     const id = normalizeId(docId);

//     if (!id) {
//       toast.error(
//         `Invalid ${kind} ID.`
//       );
//       return;
//     }

//     setDownloading(id);

//     try {
//       // IMPORTANT:
//       // This endpoint is public.
//       // Do NOT send Authorization header.
//       const url = apiUrl(
//         `/api/certificates/download/${id}`
//       );

//       const res = await fetch(url);

//       if (!res.ok) {
//         let message =
//           `Failed to download ${kind}.`;

//         try {
//           const data =
//             await res.json();

//           message =
//             data?.message ||
//             message;
//         } catch {
//           // Response may not be JSON
//         }

//         toast.error(message);
//         return;
//       }

//       const blob =
//         await res.blob();

//       if (!blob.size) {
//         toast.error(
//           `${kind} PDF is empty.`
//         );
//         return;
//       }

//       const filename =
//         kind === "marksheet"
//           ? `Marksheet_${id}.pdf`
//           : `Certificate_${id}.pdf`;

//       triggerFileSave(
//         blob,
//         filename
//       );
//     } catch (error) {
//       console.error(
//         `Download ${kind} failed:`,
//         error
//       );

//       toast.error(
//         `Failed to download ${kind}.`
//       );
//     } finally {
//       setDownloading(null);
//     }
//   };

//   // =========================================================
//   // GENERATE + DOWNLOAD
//   //
//   // This remains authenticated.
//   // Only Admin should generate.
//   // =========================================================

//   const handleGenerateAndDownload =
//     async (
//       sid: string,
//       kind:
//         | "certificate"
//         | "marksheet",
//       attempt: number
//     ) => {
//       const studentId =
//         normalizeId(sid);

//       if (!studentId) {
//         toast.error(
//           "Invalid student ID."
//         );
//         return;
//       }

//       setGenerating(
//         studentId,
//         kind,
//         attempt,
//         true
//       );

//       try {
//         const token =
//           sessionStorage.getItem(
//             "token"
//           );

//         if (!token) {
//           toast.error(
//             "Authentication token not found."
//           );
//           return;
//         }

//         const query =
//           new URLSearchParams();

//         query.set("kind", kind);
//         query.set(
//           "attempt",
//           String(attempt)
//         );

//         const url = apiUrl(
//           `/admin/students/${studentId}/documents/download?${query.toString()}`
//         );

//         const res = await fetch(url, {
//           headers: {
//             Authorization: `Bearer ${token}`,
//           },
//           redirect: "follow",
//         });

//         if (!res.ok) {
//           let message =
//             `Failed to generate ${kind}.`;

//           try {
//             const data =
//               await res.json();

//             message =
//               data?.message ||
//               message;
//           } catch {
//             // Response may not be JSON
//           }

//           toast.error(message);
//           return;
//         }

//         const blob =
//           await res.blob();

//         if (!blob.size) {
//           toast.error(
//             `${kind} PDF is empty.`
//           );
//           return;
//         }

//         const date =
//           new Date()
//             .toISOString()
//             .slice(0, 10);

//         const filename =
//           kind === "marksheet"
//             ? `Marksheet_${studentId}_${date}.pdf`
//             : `Certificate_${studentId}_${date}.pdf`;

//         triggerFileSave(
//           blob,
//           filename
//         );

//         // Reload list so the generated
//         // document ID becomes available.
//         void loadStudents();
//       } catch (error) {
//         console.error(
//           "Generate + download failed:",
//           error
//         );

//         toast.error(
//           "Generate + download failed."
//         );
//       } finally {
//         setGenerating(
//           studentId,
//           kind,
//           attempt,
//           false
//         );
//       }
//     };

//   const isLoading =
//     loadingStudents;

//   // =========================================================
//   // UI
//   // =========================================================

//   return (
//     <DashboardLayout>
//       <div className="p-6 max-w-7xl mx-auto space-y-6">

//         {/* Header */}
//         <div>
//           <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary/70 mb-1">
//             Attachments
//           </p>

//           <h1 className="font-heading font-extrabold text-3xl uppercase tracking-tight text-foreground">
//             Generate Certificates &amp; Marksheets
//           </h1>

//           <p className="text-muted-foreground text-sm font-medium mt-1 max-w-xl">
//             Browse students and download their generated
//             certificates and marksheets. Only students with
//             submitted marks are listed.
//           </p>
//         </div>

//         {/* Filters */}
//         <Card className="rounded-none border-border shadow-sm bg-muted/20">
//           <CardContent className="p-6">
//             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

//               {/* Search */}
//               <div className="space-y-1.5 lg:col-span-2">
//                 <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
//                   Search
//                 </label>

//                 <div className="relative">
//                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

//                   <Input
//                     placeholder="Search by name, father, enrollment, center..."
//                     className="pl-10 rounded-none border-border bg-background"
//                     value={searchQuery}
//                     onChange={(e) =>
//                       setSearchQuery(
//                         e.target.value
//                       )
//                     }
//                   />
//                 </div>
//               </div>

//               {/* Category */}
//               <div className="space-y-1.5">
//                 <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
//                   Category
//                 </label>

//                 <Select
//                   value={
//                     selectedCategory ||
//                     undefined
//                   }
//                   onValueChange={(value) =>
//                     setSelectedCategory(
//                       value || ""
//                     )
//                   }
//                   disabled={
//                     loadingCategories
//                   }
//                 >
//                   <SelectTrigger className="rounded-none border-border bg-background">
//                     <SelectValue
//                       placeholder={
//                         loadingCategories
//                           ? "Loading..."
//                           : "All Categories"
//                       }
//                     />
//                   </SelectTrigger>

//                   <SelectContent>
//                     <SelectItem
//                       value={
//                         SENTINEL_ALL_CATEGORIES
//                       }
//                     >
//                       All Categories
//                     </SelectItem>

//                     {categories
//                       .filter(
//                         (c) =>
//                           c.id &&
//                           c.name
//                       )
//                       .map((category) => (
//                         <SelectItem
//                           key={
//                             category.id
//                           }
//                           value={
//                             category.id
//                           }
//                         >
//                           {category.name}
//                         </SelectItem>
//                       ))}
//                   </SelectContent>
//                 </Select>
//               </div>

//               {/* Course */}
//               {selectedCategory &&
//                 selectedCategory !==
//                   SENTINEL_ALL_CATEGORIES && (
//                   <div className="space-y-1.5">
//                     <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
//                       Course
//                     </label>

//                     <Select
//                       value={
//                         selectedCourse ||
//                         undefined
//                       }
//                       onValueChange={(value) =>
//                         setSelectedCourse(
//                           value || ""
//                         )
//                       }
//                       disabled={
//                         loadingCourses
//                       }
//                     >
//                       <SelectTrigger className="rounded-none border-border bg-background">
//                         <SelectValue
//                           placeholder={
//                             loadingCourses
//                               ? "Loading..."
//                               : "All Courses"
//                           }
//                         />
//                       </SelectTrigger>

//                       <SelectContent>
//                         <SelectItem
//                           value={
//                             SENTINEL_ALL_COURSES
//                           }
//                         >
//                           All Courses in Category
//                         </SelectItem>

//                         {courses
//                           .filter(
//                             (course) =>
//                               course.id &&
//                               course.course_name
//                           )
//                           .map((course) => (
//                             <SelectItem
//                               key={
//                                 course.id
//                               }
//                               value={
//                                 course.id
//                               }
//                             >
//                               {
//                                 course.course_name
//                               }
//                             </SelectItem>
//                           ))}
//                       </SelectContent>
//                     </Select>
//                   </div>
//                 )}
//             </div>
//           </CardContent>
//         </Card>

//         {/* Students */}
//         <Card className="rounded-none border-border shadow-md overflow-hidden">

//           <CardHeader className="bg-muted/30 border-b border-border py-4">
//             <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
//               <Award className="w-4 h-4 text-primary" />

//               Students &amp; Documents

//               <span className="font-mono font-normal normal-case text-[10px] text-muted-foreground ml-2">
//                 {students.length} result
//                 {students.length === 1
//                   ? ""
//                   : "s"}
//               </span>
//             </CardTitle>
//           </CardHeader>

//           <CardContent className="p-0">
//             <div className="overflow-x-auto">

//               <table className="w-full text-left border-collapse">

//                 <thead>
//                   <tr className="text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-muted/50">

//                     <th className="px-6 py-3 border-b border-border w-16">
//                       S.No.
//                     </th>

//                     <th className="px-6 py-3 border-b border-border">
//                       Name
//                     </th>

//                     <th className="px-6 py-3 border-b border-border">
//                       Father Name
//                     </th>

//                     <th className="px-6 py-3 border-b border-border">
//                       Enrollment No.
//                     </th>

//                     <th className="px-6 py-3 border-b border-border">
//                       Course Name
//                     </th>

//                     <th className="px-6 py-3 border-b border-border">
//                       Center Name
//                     </th>

//                     <th className="px-6 py-3 border-b border-border min-w-[320px]">
//                       Action
//                     </th>

//                   </tr>
//                 </thead>

//                 <tbody>

//                   {isLoading ? (
//                     <tr>
//                       <td
//                         colSpan={7}
//                         className="px-6 py-12 text-center"
//                       >
//                         <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />

//                         <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
//                           Loading...
//                         </span>
//                       </td>
//                     </tr>
//                   ) : students.length === 0 ? (
//                     <tr>
//                       <td
//                         colSpan={7}
//                         className="px-6 py-12 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground"
//                       >
//                         No eligible students found.
//                         Students appear here once
//                         center marks are submitted or
//                         their online exam is evaluated.
//                       </td>
//                     </tr>
//                   ) : (
//                     students.map(
//                       (student, index) => {

//                         const sid =
//                           normalizeId(
//                             student.id
//                           ) ||
//                           normalizeId(
//                             student.student_id
//                           );

//                         const displayName =
//                           student.full_name?.trim() ||
//                           student.student_name?.trim() ||
//                           student.registration_number ||
//                           "—";

//                         const father =
//                           student.father_name;

//                         const enrollment =
//                           student.enrollment_number;

//                         const course =
//                           student.course_name?.trim() ||
//                           student.course?.trim() ||
//                           "—";

//                         const center =
//                           student.center_name;

//                         return (
//                           <tr
//                             key={
//                               sid ||
//                               index
//                             }
//                             className="hover:bg-primary/5 transition-colors border-b border-border align-top"
//                           >

//                             <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
//                               {index + 1}
//                             </td>

//                             <td className="px-6 py-4 font-bold break-words max-w-[200px]">
//                               {displayName}
//                             </td>

//                             <td className="px-6 py-4 break-words max-w-[200px]">
//                               {father ||
//                                 "—"}
//                             </td>

//                             <td className="px-6 py-4 text-xs font-mono">
//                               {enrollment ||
//                                 student.registration_number ||
//                                 "—"}
//                             </td>

//                             <td className="px-6 py-4 break-words max-w-[220px]">
//                               {course}
//                             </td>

//                             <td className="px-6 py-4 text-xs break-words max-w-[200px]">
//                               {center ||
//                                 "—"}
//                             </td>

//                             <td className="px-6 py-4">

//                               {student.attempts.length ===
//                               0 ? (
//                                 <span className="text-xs text-muted-foreground italic">
//                                   No attempts available
//                                 </span>
//                               ) : (
//                                 <div className="flex flex-col gap-3">

//                                   {student.attempts.map(
//                                     (attempt) => {

//                                       const marksheetId =
//                                         normalizeId(
//                                           attempt.marksheet_id
//                                         );

//                                       const certificateId =
//                                         normalizeId(
//                                           attempt.certificate_id
//                                         );

//                                       const isGeneratingMarksheet =
//                                         generatingMap[
//                                           actionKey(
//                                             sid,
//                                             "marksheet",
//                                             attempt.attempt_number
//                                           )
//                                         ];

//                                       const isGeneratingCertificate =
//                                         generatingMap[
//                                           actionKey(
//                                             sid,
//                                             "certificate",
//                                             attempt.attempt_number
//                                           )
//                                         ];

//                                       return (
//                                         <div
//                                           key={
//                                             attempt.attempt_number
//                                           }
//                                           className="space-y-2"
//                                         >

//                                           <div className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
//                                             Attempt{" "}
//                                             {
//                                               attempt.attempt_number
//                                             }
//                                           </div>

//                                           <div className="flex flex-wrap gap-2">

//                                             {/* ===================== */}
//                                             {/* MARKSHEET */}
//                                             {/* ===================== */}

//                                             {marksheetId ? (
//                                               <Button
//                                                 type="button"
//                                                 size="sm"
//                                                 className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-none"
//                                                 onClick={() =>
//                                                   handleDownloadExisting(
//                                                     marksheetId,
//                                                     "marksheet"
//                                                   )
//                                                 }
//                                                 disabled={
//                                                   downloading ===
//                                                   marksheetId
//                                                 }
//                                               >
//                                                 {downloading ===
//                                                 marksheetId ? (
//                                                   <Loader2 className="w-3 h-3 mr-1 animate-spin" />
//                                                 ) : (
//                                                   <FileSpreadsheet className="w-3 h-3 mr-1" />
//                                                 )}

//                                                 Download Marksheet
//                                               </Button>
//                                             ) : (
//                                               <Button
//                                                 type="button"
//                                                 size="sm"
//                                                 className="h-8 px-3 bg-blue-500 hover:bg-blue-600 text-white rounded-none"
//                                                 onClick={() =>
//                                                   handleGenerateAndDownload(
//                                                     sid,
//                                                     "marksheet",
//                                                     attempt.attempt_number
//                                                   )
//                                                 }
//                                                 disabled={
//                                                   isGeneratingMarksheet
//                                                 }
//                                               >
//                                                 {isGeneratingMarksheet ? (
//                                                   <>
//                                                     <Loader2 className="w-3 h-3 mr-1 animate-spin" />
//                                                     Generating…
//                                                   </>
//                                                 ) : (
//                                                   <>
//                                                     <Download className="w-3 h-3 mr-1" />
//                                                     Generate Marksheet
//                                                   </>
//                                                 )}
//                                               </Button>
//                                             )}

//                                             {/* ===================== */}
//                                             {/* CERTIFICATE */}
//                                             {/* ===================== */}

//                                             {certificateId ? (
//                                               <Button
//                                                 type="button"
//                                                 size="sm"
//                                                 className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-none"
//                                                 onClick={() =>
//                                                   handleDownloadExisting(
//                                                     certificateId,
//                                                     "certificate"
//                                                   )
//                                                 }
//                                                 disabled={
//                                                   downloading ===
//                                                   certificateId
//                                                 }
//                                               >
//                                                 {downloading ===
//                                                 certificateId ? (
//                                                   <Loader2 className="w-3 h-3 mr-1 animate-spin" />
//                                                 ) : (
//                                                   <Award className="w-3 h-3 mr-1" />
//                                                 )}

//                                                 Download Certificate
//                                               </Button>
//                                             ) : (
//                                               <Button
//                                                 type="button"
//                                                 size="sm"
//                                                 className="h-8 px-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-none"
//                                                 onClick={() =>
//                                                   handleGenerateAndDownload(
//                                                     sid,
//                                                     "certificate",
//                                                     attempt.attempt_number
//                                                   )
//                                                 }
//                                                 disabled={
//                                                   isGeneratingCertificate
//                                                 }
//                                               >
//                                                 {isGeneratingCertificate ? (
//                                                   <>
//                                                     <Loader2 className="w-3 h-3 mr-1 animate-spin" />
//                                                     Generating…
//                                                   </>
//                                                 ) : (
//                                                   <>
//                                                     <FileBadge className="w-3 h-3 mr-1" />
//                                                     Generate Certificate
//                                                   </>
//                                                 )}
//                                               </Button>
//                                             )}

//                                           </div>
//                                         </div>
//                                       );
//                                     }
//                                   )}

//                                 </div>
//                               )}

//                             </td>
//                           </tr>
//                         );
//                       }
//                     )
//                   )}

//                 </tbody>
//               </table>
//             </div>
//           </CardContent>
//         </Card>

//       </div>
//     </DashboardLayout>
//   );
// }





import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { apiFetch, apiUrl } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Download,
  Award,
  Loader2,
  FileSpreadsheet,
  FileBadge,
} from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
}

interface CourseItem {
  id: string;
  course_name: string;
}

interface StudentAttempt {
  attempt_number: number;
  marksheet_id?: string | null;
  certificate_id?: string | null;
}

interface EligibleStudent {
  id: string;
  student_id: string;
  student_name: string;
  full_name: string;
  registration_number: string;
  father_name?: string | null;
  enrollment_number?: string | null;
  course: string;
  course_name: string;
  center_name?: string | null;
  attempts: StudentAttempt[];
}

function normalizeId(v: any): string {
  if (v == null) return "";

  if (typeof v === "string") {
    const t = v.trim();

    return /^[a-f0-9]{24}$/i.test(t)
      ? t.toLowerCase()
      : t;
  }

  if (typeof v === "object" && v !== null) {
    if (
      "$oid" in v &&
      typeof (v as any).$oid === "string"
    ) {
      return normalizeId((v as any).$oid);
    }

    if ("id" in v) {
      return normalizeId((v as any).id);
    }

    if ("_id" in v) {
      return normalizeId((v as any)._id);
    }
  }

  return String(v ?? "").toLowerCase();
}

const SENTINEL_ALL_CATEGORIES = "__all_categories__";
const SENTINEL_ALL_COURSES = "__all_courses__";

export default function GenerateCertificatesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [selectedCategory, setSelectedCategory] =
    useState<string>("");

  const [selectedCourse, setSelectedCourse] =
    useState<string>("");

  const [categories, setCategories] =
    useState<Category[]>([]);

  const [courses, setCourses] =
    useState<CourseItem[]>([]);

  const [students, setStudents] =
    useState<EligibleStudent[]>([]);

  const [loadingStudents, setLoadingStudents] =
    useState(false);

  const [loadingCategories, setLoadingCategories] =
    useState(false);

  const [loadingCourses, setLoadingCourses] =
    useState(false);

  const [generatingMap, setGeneratingMap] =
    useState<Record<string, boolean>>({});

  const [downloading, setDownloading] =
    useState<string | null>(null);

  // =========================================================
  // Debounce search
  // =========================================================

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // =========================================================
  // Load categories
  // =========================================================

  const loadCategories = useCallback(async () => {
    setLoadingCategories(true);

    try {
      const res = await apiFetch(
        "/api/public/categories"
      );

      if (!res.ok) {
        setCategories([]);
        return;
      }

      const data = await res.json();

      const list: any[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : [];

      setCategories(
        list
          .map((c: any) => ({
            id: c.id ?? c._id ?? "",
            name: c.name ?? "",
          }))
          .filter(
            (c: Category) =>
              c.id && c.name
          )
      );
    } catch (error) {
      console.error(
        "Failed to load categories:",
        error
      );

      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  // =========================================================
  // Load courses
  // =========================================================

  const loadCourses = useCallback(
    async (sentinelCategoryId: string) => {
      const categoryId =
        sentinelCategoryId ===
        SENTINEL_ALL_CATEGORIES
          ? ""
          : sentinelCategoryId;

      if (!categoryId) {
        setCourses([]);
        return;
      }

      setLoadingCourses(true);

      try {
        let res = await apiFetch(
          `/api/courses?category_id=${encodeURIComponent(
            categoryId
          )}`
        );

        if (!res.ok) {
          res = await apiFetch(
            `/api/public/courses?category_id=${encodeURIComponent(
              categoryId
            )}`
          );
        }

        if (!res.ok) {
          setCourses([]);
          return;
        }

        const data = await res.json();

        setCourses(
          Array.isArray(data)
            ? data
            : []
        );
      } catch (error) {
        console.error(
          "Failed to load courses:",
          error
        );

        setCourses([]);
      } finally {
        setLoadingCourses(false);
      }
    },
    []
  );

  // =========================================================
  // Load eligible students
  // =========================================================

  const loadStudents = useCallback(async () => {
    setLoadingStudents(true);

    try {
      const params = new URLSearchParams();

      if (debouncedSearch) {
        params.set(
          "search",
          debouncedSearch
        );
      }

      const realCategory =
        selectedCategory ===
        SENTINEL_ALL_CATEGORIES
          ? ""
          : selectedCategory;

      const realCourse =
        selectedCourse ===
        SENTINEL_ALL_COURSES
          ? ""
          : selectedCourse;

      if (realCategory) {
        params.set(
          "categoryId",
          realCategory
        );
      }

      if (realCourse) {
        params.set(
          "courseId",
          realCourse
        );
      }

      const queryString =
        params.toString();

      const url =
        `/api/admin/marksheets/eligible${
          queryString
            ? `?${queryString}`
            : ""
        }`;

      const res = await apiFetch(url);

      if (!res.ok) {
        setStudents([]);
        return;
      }

      const data = await res.json();

      setStudents(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (error) {
      console.error(
        "Failed to load students:",
        error
      );

      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  }, [
    debouncedSearch,
    selectedCategory,
    selectedCourse,
  ]);

  // =========================================================
  // Initial categories
  // =========================================================

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  // =========================================================
  // Category changed
  // =========================================================

  useEffect(() => {
    const realCategory =
      selectedCategory ===
      SENTINEL_ALL_CATEGORIES
        ? ""
        : selectedCategory;

    if (realCategory) {
      void loadCourses(
        selectedCategory
      );
    } else {
      setCourses([]);
    }

    setSelectedCourse("");
  }, [
    selectedCategory,
    loadCourses,
  ]);

  // =========================================================
  // Reload students
  // =========================================================

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  // =========================================================
  // Action key
  // =========================================================

  const actionKey = (
    sid: string,
    kind: string,
    attempt: number
  ) => {
    return `${sid}::${kind}::${attempt}`;
  };

  // =========================================================
  // Generation state
  // =========================================================

  const setGenerating = (
    sid: string,
    kind: string,
    attempt: number,
    value: boolean
  ) => {
    setGeneratingMap((prev) => ({
      ...prev,
      [actionKey(
        sid,
        kind,
        attempt
      )]: value,
    }));
  };

  // =========================================================
  // Save blob to file
  // =========================================================

  const triggerFileSave = (
    blob: Blob,
    filename: string
  ) => {
    const blobUrl =
      window.URL.createObjectURL(blob);

    const anchor =
      document.createElement("a");

    anchor.href = blobUrl;
    anchor.download = filename;

    document.body.appendChild(anchor);

    anchor.click();

    document.body.removeChild(anchor);

    window.URL.revokeObjectURL(blobUrl);
  };

  // =========================================================
  // DOWNLOAD EXISTING DOCUMENT
  //
  // GET /api/certificates/download/:id
  //
  // This endpoint currently has no server-side auth check
  // (see backend handlers::certificate::download_certificate),
  // but we send the Authorization header anyway so that:
  //   1. Any auth/ownership check added on the backend later
  //      (which it should have) works immediately without a
  //      second frontend change.
  //   2. Server-side logs/metrics can attribute the download
  //      to a user instead of an anonymous caller.
  // If there's no token (e.g. a genuinely public verification
  // flow), we still allow the request to go out, matching the
  // current backend behavior.
  // =========================================================

  const handleDownloadExisting = async (
    docId: any,
    kind: "certificate" | "marksheet"
  ) => {
    const id = normalizeId(docId);

    if (!id) {
      toast.error(
        `Invalid ${kind} ID.`
      );
      return;
    }

    setDownloading(id);

    try {
      const token =
        sessionStorage.getItem("token");

      if (!token) {
        toast.error(
          "Authentication token not found. Please log in again."
        );
        return;
      }

      const url = apiUrl(
        `/api/certificates/download/${id}`
      );

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401 || res.status === 403) {
        toast.error(
          "You are not authorized to download this document."
        );
        return;
      }

      if (!res.ok) {
        let message =
          `Failed to download ${kind}.`;

        try {
          const data =
            await res.json();

          message =
            data?.message ||
            message;
        } catch {
          // Response may not be JSON
        }

        toast.error(message);
        return;
      }

      const blob =
        await res.blob();

      if (!blob.size) {
        toast.error(
          `${kind} PDF is empty.`
        );
        return;
      }

      const filename =
        kind === "marksheet"
          ? `Marksheet_${id}.pdf`
          : `Certificate_${id}.pdf`;

      triggerFileSave(
        blob,
        filename
      );
    } catch (error) {
      console.error(
        `Download ${kind} failed:`,
        error
      );

      toast.error(
        `Failed to download ${kind}.`
      );
    } finally {
      setDownloading(null);
    }
  };

  // =========================================================
  // GENERATE + DOWNLOAD
  //
  // Authenticated. Only Admin should generate.
  // =========================================================

  const handleGenerateAndDownload =
    async (
      sid: string,
      kind:
        | "certificate"
        | "marksheet",
      attempt: number
    ) => {
      const studentId =
        normalizeId(sid);

      if (!studentId) {
        toast.error(
          "Invalid student ID."
        );
        return;
      }

      setGenerating(
        studentId,
        kind,
        attempt,
        true
      );

      try {
        const token =
          sessionStorage.getItem(
            "token"
          );

        if (!token) {
          toast.error(
            "Authentication token not found."
          );
          return;
        }

        const query =
          new URLSearchParams();

        query.set("kind", kind);
        query.set(
          "attempt",
          String(attempt)
        );

        const url = apiUrl(
          `/admin/students/${studentId}/documents/download?${query.toString()}`
        );

        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          redirect: "follow",
        });

        if (!res.ok) {
          let message =
            `Failed to generate ${kind}.`;

          try {
            const data =
              await res.json();

            message =
              data?.message ||
              message;
          } catch {
            // Response may not be JSON
          }

          toast.error(message);
          return;
        }

        const blob =
          await res.blob();

        if (!blob.size) {
          toast.error(
            `${kind} PDF is empty.`
          );
          return;
        }

        const date =
          new Date()
            .toISOString()
            .slice(0, 10);

        const filename =
          kind === "marksheet"
            ? `Marksheet_${studentId}_${date}.pdf`
            : `Certificate_${studentId}_${date}.pdf`;

        triggerFileSave(
          blob,
          filename
        );

        // Reload list so the generated
        // document ID becomes available.
        void loadStudents();
      } catch (error) {
        console.error(
          "Generate + download failed:",
          error
        );

        toast.error(
          "Generate + download failed."
        );
      } finally {
        setGenerating(
          studentId,
          kind,
          attempt,
          false
        );
      }
    };

  const isLoading =
    loadingStudents;

  // =========================================================
  // UI
  // =========================================================

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary/70 mb-1">
            Attachments
          </p>

          <h1 className="font-heading font-extrabold text-3xl uppercase tracking-tight text-foreground">
            Generate Certificates &amp; Marksheets
          </h1>

          <p className="text-muted-foreground text-sm font-medium mt-1 max-w-xl">
            Browse students and download their generated
            certificates and marksheets. Only students with
            submitted marks are listed.
          </p>
        </div>

        {/* Filters */}
        <Card className="rounded-none border-border shadow-sm bg-muted/20">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

              {/* Search */}
              <div className="space-y-1.5 lg:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
                  Search
                </label>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

                  <Input
                    placeholder="Search by name, father, enrollment, center..."
                    className="pl-10 rounded-none border-border bg-background"
                    value={searchQuery}
                    onChange={(e) =>
                      setSearchQuery(
                        e.target.value
                      )
                    }
                  />
                </div>
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
                  Category
                </label>

                <Select
                  value={
                    selectedCategory ||
                    undefined
                  }
                  onValueChange={(value) =>
                    setSelectedCategory(
                      value || ""
                    )
                  }
                  disabled={
                    loadingCategories
                  }
                >
                  <SelectTrigger className="rounded-none border-border bg-background">
                    <SelectValue
                      placeholder={
                        loadingCategories
                          ? "Loading..."
                          : "All Categories"
                      }
                    />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem
                      value={
                        SENTINEL_ALL_CATEGORIES
                      }
                    >
                      All Categories
                    </SelectItem>

                    {categories
                      .filter(
                        (c) =>
                          c.id &&
                          c.name
                      )
                      .map((category) => (
                        <SelectItem
                          key={
                            category.id
                          }
                          value={
                            category.id
                          }
                        >
                          {category.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Course */}
              {selectedCategory &&
                selectedCategory !==
                  SENTINEL_ALL_CATEGORIES && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
                      Course
                    </label>

                    <Select
                      value={
                        selectedCourse ||
                        undefined
                      }
                      onValueChange={(value) =>
                        setSelectedCourse(
                          value || ""
                        )
                      }
                      disabled={
                        loadingCourses
                      }
                    >
                      <SelectTrigger className="rounded-none border-border bg-background">
                        <SelectValue
                          placeholder={
                            loadingCourses
                              ? "Loading..."
                              : "All Courses"
                          }
                        />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem
                          value={
                            SENTINEL_ALL_COURSES
                          }
                        >
                          All Courses in Category
                        </SelectItem>

                        {courses
                          .filter(
                            (course) =>
                              course.id &&
                              course.course_name
                          )
                          .map((course) => (
                            <SelectItem
                              key={
                                course.id
                              }
                              value={
                                course.id
                              }
                            >
                              {
                                course.course_name
                              }
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
            </div>
          </CardContent>
        </Card>

        {/* Students */}
        <Card className="rounded-none border-border shadow-md overflow-hidden">

          <CardHeader className="bg-muted/30 border-b border-border py-4">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <Award className="w-4 h-4 text-primary" />

              Students &amp; Documents

              <span className="font-mono font-normal normal-case text-[10px] text-muted-foreground ml-2">
                {students.length} result
                {students.length === 1
                  ? ""
                  : "s"}
              </span>
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">

              <table className="w-full text-left border-collapse">

                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-muted/50">

                    <th className="px-6 py-3 border-b border-border w-16">
                      S.No.
                    </th>

                    <th className="px-6 py-3 border-b border-border">
                      Name
                    </th>

                    <th className="px-6 py-3 border-b border-border">
                      Father Name
                    </th>

                    <th className="px-6 py-3 border-b border-border">
                      Enrollment No.
                    </th>

                    <th className="px-6 py-3 border-b border-border">
                      Course Name
                    </th>

                    <th className="px-6 py-3 border-b border-border">
                      Center Name
                    </th>

                    <th className="px-6 py-3 border-b border-border min-w-[320px]">
                      Action
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-12 text-center"
                      >
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />

                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          Loading...
                        </span>
                      </td>
                    </tr>
                  ) : students.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-12 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground"
                      >
                        No eligible students found.
                        Students appear here once
                        center marks are submitted or
                        their online exam is evaluated.
                      </td>
                    </tr>
                  ) : (
                    students.map(
                      (student, index) => {

                        const sid =
                          normalizeId(
                            student.id
                          ) ||
                          normalizeId(
                            student.student_id
                          );

                        const displayName =
                          student.full_name?.trim() ||
                          student.student_name?.trim() ||
                          student.registration_number ||
                          "—";

                        const father =
                          student.father_name;

                        const enrollment =
                          student.enrollment_number;

                        const course =
                          student.course_name?.trim() ||
                          student.course?.trim() ||
                          "—";

                        const center =
                          student.center_name;

                        return (
                          <tr
                            key={
                              sid ||
                              index
                            }
                            className="hover:bg-primary/5 transition-colors border-b border-border align-top"
                          >

                            <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                              {index + 1}
                            </td>

                            <td className="px-6 py-4 font-bold break-words max-w-[200px]">
                              {displayName}
                            </td>

                            <td className="px-6 py-4 break-words max-w-[200px]">
                              {father ||
                                "—"}
                            </td>

                            <td className="px-6 py-4 text-xs font-mono">
                              {enrollment ||
                                student.registration_number ||
                                "—"}
                            </td>

                            <td className="px-6 py-4 break-words max-w-[220px]">
                              {course}
                            </td>

                            <td className="px-6 py-4 text-xs break-words max-w-[200px]">
                              {center ||
                                "—"}
                            </td>

                            <td className="px-6 py-4">

                              {student.attempts.length ===
                              0 ? (
                                <span className="text-xs text-muted-foreground italic">
                                  No attempts available
                                </span>
                              ) : (
                                <div className="flex flex-col gap-3">

                                  {student.attempts.map(
                                    (attempt) => {

                                      const marksheetId =
                                        normalizeId(
                                          attempt.marksheet_id
                                        );

                                      const certificateId =
                                        normalizeId(
                                          attempt.certificate_id
                                        );

                                      const isGeneratingMarksheet =
                                        generatingMap[
                                          actionKey(
                                            sid,
                                            "marksheet",
                                            attempt.attempt_number
                                          )
                                        ];

                                      const isGeneratingCertificate =
                                        generatingMap[
                                          actionKey(
                                            sid,
                                            "certificate",
                                            attempt.attempt_number
                                          )
                                        ];

                                      return (
                                        <div
                                          key={
                                            attempt.attempt_number
                                          }
                                          className="space-y-2"
                                        >

                                          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                                            Attempt{" "}
                                            {
                                              attempt.attempt_number
                                            }
                                          </div>

                                          <div className="flex flex-wrap gap-2">

                                            {/* ===================== */}
                                            {/* MARKSHEET */}
                                            {/* ===================== */}

                                            {marksheetId ? (
                                              <Button
                                                type="button"
                                                size="sm"
                                                className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-none"
                                                onClick={() =>
                                                  handleDownloadExisting(
                                                    marksheetId,
                                                    "marksheet"
                                                  )
                                                }
                                                disabled={
                                                  downloading ===
                                                  marksheetId
                                                }
                                              >
                                                {downloading ===
                                                marksheetId ? (
                                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                ) : (
                                                  <FileSpreadsheet className="w-3 h-3 mr-1" />
                                                )}

                                                Download Marksheet
                                              </Button>
                                            ) : (
                                              <Button
                                                type="button"
                                                size="sm"
                                                className="h-8 px-3 bg-blue-500 hover:bg-blue-600 text-white rounded-none"
                                                onClick={() =>
                                                  handleGenerateAndDownload(
                                                    sid,
                                                    "marksheet",
                                                    attempt.attempt_number
                                                  )
                                                }
                                                disabled={
                                                  isGeneratingMarksheet
                                                }
                                              >
                                                {isGeneratingMarksheet ? (
                                                  <>
                                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                    Generating…
                                                  </>
                                                ) : (
                                                  <>
                                                    <Download className="w-3 h-3 mr-1" />
                                                    Generate Marksheet
                                                  </>
                                                )}
                                              </Button>
                                            )}

                                            {/* ===================== */}
                                            {/* CERTIFICATE */}
                                            {/* ===================== */}

                                            {certificateId ? (
                                              <Button
                                                type="button"
                                                size="sm"
                                                className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-none"
                                                onClick={() =>
                                                  handleDownloadExisting(
                                                    certificateId,
                                                    "certificate"
                                                  )
                                                }
                                                disabled={
                                                  downloading ===
                                                  certificateId
                                                }
                                              >
                                                {downloading ===
                                                certificateId ? (
                                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                ) : (
                                                  <Award className="w-3 h-3 mr-1" />
                                                )}

                                                Download Certificate
                                              </Button>
                                            ) : (
                                              <Button
                                                type="button"
                                                size="sm"
                                                className="h-8 px-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-none"
                                                onClick={() =>
                                                  handleGenerateAndDownload(
                                                    sid,
                                                    "certificate",
                                                    attempt.attempt_number
                                                  )
                                                }
                                                disabled={
                                                  isGeneratingCertificate
                                                }
                                              >
                                                {isGeneratingCertificate ? (
                                                  <>
                                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                    Generating…
                                                  </>
                                                ) : (
                                                  <>
                                                    <FileBadge className="w-3 h-3 mr-1" />
                                                    Generate Certificate
                                                  </>
                                                )}
                                              </Button>
                                            )}

                                          </div>
                                        </div>
                                      );
                                    }
                                  )}

                                </div>
                              )}

                            </td>
                          </tr>
                        );
                      }
                    )
                  )}

                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
}