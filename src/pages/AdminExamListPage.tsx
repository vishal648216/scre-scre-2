import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  FileText, Loader2, Search, Filter, Clock, User, CheckCircle2, AlertCircle, 
  Eye, RotateCcw, Trash2, Printer, Ticket, BookOpen, Layers, Award, Sparkles, 
  Download, Check, X, HelpCircle, FileCheck, ChevronRight, Plus, RefreshCw, 
  FileSpreadsheet, Copy, Calendar, ShieldCheck, CheckSquare, Send, Bookmark
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface StudentPaper {
  _id: string;
  blueprint_id: string;
  student_id: string;
  status: string;
  total_obtained_marks: number;
  created_at: string;
  submit_time?: string;
}

interface Blueprint {
  _id: string;
  name: string;
  course_id?: string;
  course_name?: string;
  category_id?: string;
  total_marks?: number;
  minimum_marks?: number;
  duration_minutes?: number;
  exam_mode?: string;
  instructions?: string;
  subjects?: any[];
  rules?: any[];
  sections?: any[];
}

interface Student {
  _id: string;
  name?: string;
  full_name?: string;
  registration_number?: string;
  enrollment_number?: string;
  roll_number?: string;
}

interface Course {
  _id: string;
  id?: string;
  course_name: string;
  short_code?: string;
}

interface QuestionItem {
  id: number;
  question: string;
  options: string[];
  correctOption: number;
  marks: number;
  type: "mcq" | "short" | "long";
  explanation?: string;
}

const MOCK_QUESTION_BANKS: Record<string, { mcqs: QuestionItem[]; short: QuestionItem[]; long: QuestionItem[] }> = {
  default: {
    mcqs: [
      { id: 1, question: "What is the primary function of the Central Processing Unit (CPU) in a computer?", options: ["Store permanent user data", "Perform mathematical & logical operations", "Provide power supply to peripherals", "Display graphical output"], correctOption: 1, marks: 2, type: "mcq", explanation: "CPU handles all processing, calculation and execution of instructions." },
      { id: 2, question: "Which of the following shortcut keys is used to paste copied text in MS Word?", options: ["Ctrl + C", "Ctrl + P", "Ctrl + V", "Ctrl + X"], correctOption: 2, marks: 2, type: "mcq", explanation: "Ctrl + V is the universal key combo for paste action." },
      { id: 3, question: "In Tally Prime, which accounting voucher key is used for Contra transactions?", options: ["F4", "F5", "F6", "F8"], correctOption: 0, marks: 2, type: "mcq", explanation: "F4 is dedicated to Contra Vouchers (Cash/Bank transfers)." },
      { id: 4, question: "Which HTML tag is used to create a hyper-link to another webpage?", options: ["<link>", "<a>", "<href>", "<url>"], correctOption: 1, marks: 1, type: "mcq", explanation: "The <a> anchor tag defines hyperlinks in HTML." },
      { id: 5, question: "What does DBMS stand for in computer database management?", options: ["Data Base Manipulation System", "Database Management System", "Digital Binary Memory Storage", "Direct Backup Memory Software"], correctOption: 1, marks: 1, type: "mcq", explanation: "DBMS refers to Database Management System software like MySQL, MongoDB." },
      { id: 6, question: "In MS Excel, which formula function is used to add values in a specified range of cells?", options: ["=ADD()", "=SUM()", "=TOTAL()", "=COUNT()"], correctOption: 1, marks: 2, type: "mcq", explanation: "=SUM(A1:A10) calculates the total sum of numbers in the range." },
      { id: 7, question: "Which protocol is primarily used for secure web communication over the internet?", options: ["HTTP", "HTTPS", "FTP", "SMTP"], correctOption: 1, marks: 2, type: "mcq", explanation: "HTTPS encrypts data transferred between browser and web server using TLS/SSL." },
      { id: 8, question: "What type of memory is RAM (Random Access Memory)?", options: ["Non-volatile & Permanent", "Volatile & Temporary", "Optical Storage", "Magnetic Storage"], correctOption: 1, marks: 2, type: "mcq", explanation: "RAM loses its contents when power is turned off, making it volatile." },
      { id: 9, question: "Which GST component is applicable on intra-state sales transactions within the same state?", options: ["IGST only", "CGST and SGST", "UTGST only", "Custom Duty"], correctOption: 1, marks: 2, type: "mcq", explanation: "Intra-state supply attracts equal distribution of CGST + SGST." },
      { id: 10, question: "In CSS layout, which property sets the outer space around an element box?", options: ["padding", "border", "margin", "spacing"], correctOption: 2, marks: 2, type: "mcq", explanation: "Margin adds space outside the border of an element." },
      { id: 11, question: "Which key is used to start a slide show presentation from the beginning in MS PowerPoint?", options: ["F5", "F1", "Ctrl + F5", "Esc"], correctOption: 0, marks: 2, type: "mcq", explanation: "Pressing F5 launches slideshow from slide 1." },
      { id: 12, question: "What is the extension of an Adobe Photoshop source design file?", options: [".docx", ".psd", ".pdf", ".ai"], correctOption: 1, marks: 2, type: "mcq", explanation: ".psd stands for Photoshop Document." },
      { id: 13, question: "Which component of an Operating System directly manages hardware devices and memory?", options: ["GUI Shell", "Kernel", "Text Editor", "File Explorer"], correctOption: 1, marks: 2, type: "mcq", explanation: "Kernel is the core layer of the OS interacting directly with hardware." },
      { id: 14, question: "In Python, which keyword is used to define a custom function?", options: ["function", "def", "func", "create"], correctOption: 1, marks: 2, type: "mcq", explanation: "'def' keyword declares a function in Python syntax." },
      { id: 15, question: "What does IP stand for in network communication?", options: ["Internet Provider", "Internet Protocol", "Internal Program", "Interconnect Port"], correctOption: 1, marks: 2, type: "mcq", explanation: "IP refers to Internet Protocol address." }
    ],
    short: [
      { id: 16, question: "Explain the differences between RAM and ROM memory with suitable real-world examples.", options: [], correctOption: 0, marks: 5, type: "short" },
      { id: 17, question: "What is GST Voucher Entry in Tally Prime? List the key voucher types used for Purchase and Sales.", options: [], correctOption: 0, marks: 5, type: "short" },
      { id: 18, question: "Describe the function of Mail Merge in MS Word and step-by-step procedure to send bulk letters.", options: [], correctOption: 0, marks: 5, type: "short" },
      { id: 19, question: "What are CSS Selectors? Explain Class, ID, and Element selectors with code examples.", options: [], correctOption: 0, marks: 5, type: "short" },
      { id: 20, question: "Define Database Primary Key and Foreign Key constraints in SQL relational databases.", options: [], correctOption: 0, marks: 5, type: "short" },
      { id: 21, question: "Write a short note on Computer Virus prevention techniques and Firewall security.", options: [], correctOption: 0, marks: 5, type: "short" }
    ],
    long: [
      { id: 22, question: "Draw and explain the block diagram of a digital computer system. Detail the architecture of Input Unit, Output Unit, ALU, Control Unit, and Storage hierarchy.", options: [], correctOption: 0, marks: 10, type: "long" },
      { id: 23, question: "Practical Financial Accounting: Explain how to set up Company Masters, Stock Groups, Ledger Accounts, and record GST compliant Purchase & Sales transactions in Tally Prime. Provide step-by-step voucher posting.", options: [], correctOption: 0, marks: 10, type: "long" },
      { id: 24, question: "Web Designing Practical Task: Write clean HTML5 and CSS3 code to design a responsive Student Registration Form containing text fields, radio buttons, dropdowns, submit buttons, and styled layout cards.", options: [], correctOption: 0, marks: 10, type: "long" },
      { id: 25, question: "MS Excel Data Analysis: Explain VLOOKUP, HLOOKUP, IF-ELSE conditions, and Pivot Tables. Give a practical scenario where a Pivot table is used to generate monthly sales summary reports.", options: [], correctOption: 0, marks: 10, type: "long" }
    ]
  }
};

const DEFAULT_CURATED_BLUEPRINTS: Blueprint[] = [
  {
    _id: "bp_dca_001",
    name: "DCA - Diploma in Computer Applications (Annual Exam Blueprint)",
    course_name: "Diploma in Computer Applications (DCA)",
    total_marks: 100,
    minimum_marks: 40,
    duration_minutes: 180,
    exam_mode: "Computer Based Test (CBT) & Theory",
    instructions: "1. All questions are compulsory.\n2. Section A contains 15 MCQs of 2 marks each.\n3. Section B contains 6 short answer questions of 5 marks each.\n4. Section C contains 4 practical/descriptive questions of 10 marks each.",
  },
  {
    _id: "bp_adca_002",
    name: "ADCA - Advanced Diploma in Computer Applications (Comprehensive Blueprint)",
    course_name: "Advanced Diploma in Computer Applications (ADCA)",
    total_marks: 100,
    minimum_marks: 40,
    duration_minutes: 180,
    exam_mode: "Computer Based Test (CBT)",
    instructions: "1. Time duration is 3 Hours.\n2. Attempt all sections.\n3. Negative marking is NOT applicable.",
  },
  {
    _id: "bp_tally_003",
    name: "Tally Prime with GST & Financial Accounting Certification Exam",
    course_name: "Tally Prime with GST",
    total_marks: 100,
    minimum_marks: 50,
    duration_minutes: 120,
    exam_mode: "Practical & CBT",
    instructions: "1. Read transaction journal entries carefully.\n2. Prepare vouchers in accordance with standard GST tax rules.",
  },
  {
    _id: "bp_web_004",
    name: "Web Development & Full Stack Software Engineering Blueprint",
    course_name: "Certificate in Web Development",
    total_marks: 100,
    minimum_marks: 40,
    duration_minutes: 180,
    exam_mode: "Online CBT & Code Submission",
    instructions: "1. Ensure HTML syntax is valid.\n2. Write modular CSS and JavaScript logic.",
  }
];

const AdminExamListPage = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"blueprints" | "papers">("blueprints");
  const [papers, setPapers] = useState<StudentPaper[]>([]);
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState("");

  const [selectedBlueprintForPaper, setSelectedBlueprintForPaper] = useState<Blueprint | null>(null);
  const [selectedPaperSet, setSelectedPaperSet] = useState<"A" | "B" | "C">("A");
  const [showAnswerKey, setShowAnswerKey] = useState<boolean>(false);
  const [paperModalOpen, setPaperModalOpen] = useState<boolean>(false);

  const toId = (v: any): string => {
    if (!v) return "";
    if (typeof v === "string") return v;
    if (typeof v === "object" && "$oid" in v) return String(v.$oid || "");
    return String(v || "");
  };

  const formatSafeDate = (dateStr: any, formatStr: string = "dd MMM yyyy") => {
    try {
      if (!dateStr || dateStr === "undefined" || dateStr === "null") return "N/A";
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "N/A";
      return format(d, formatStr);
    } catch (e) {
      return "N/A";
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [papersRes, blueprintsRes, studentsRes, coursesRes] = await Promise.all([
        apiFetch("/api/exam/papers").catch(() => null),
        apiFetch("/api/exam/blueprints").catch(() => null),
        apiFetch("/api/students").catch(() => null),
        apiFetch("/api/courses").catch(() => null)
      ]);
      
      if (papersRes && papersRes.ok) {
        const raw = await papersRes.json().catch(() => []);
        const items = Array.isArray(raw) ? raw : (raw?.items || []);
        setPapers((items || []).filter(Boolean).map((p: any) => ({
          ...p,
          _id: toId(p._id),
          student_id: toId(p.student_id),
          blueprint_id: toId(p.blueprint_id)
        })));
      }

      let fetchedBlueprints: Blueprint[] = [];
      if (blueprintsRes && blueprintsRes.ok) {
        const raw = await blueprintsRes.json().catch(() => []);
        const items = Array.isArray(raw) ? raw : (raw?.items || []);
        fetchedBlueprints = (items || []).filter(Boolean).map((b: any) => ({ ...b, _id: toId(b._id) }));
      }

      let mappedCourses: Course[] = [];
      if (coursesRes && coursesRes.ok) {
        const raw = await coursesRes.json().catch(() => []);
        const items = Array.isArray(raw) ? raw : (raw?.items || []);
        mappedCourses = (items || []).filter(Boolean).map((c: any) => ({ ...c, _id: toId(c._id || c.id) }));
        setCourses(mappedCourses);

        fetchedBlueprints = fetchedBlueprints.map(bp => {
          if (!bp) return bp;
          const matchedCourse = mappedCourses.find((c: any) => c && c._id === bp.course_id);
          return {
            ...bp,
            course_name: matchedCourse ? matchedCourse.course_name : bp.course_name || bp.name
          };
        });
      }

      if (studentsRes && studentsRes.ok) {
        const raw = await studentsRes.json().catch(() => []);
        const items = Array.isArray(raw) ? raw : (raw?.items || []);
        setStudents((items || []).filter(Boolean).map((s: any) => ({ ...s, _id: toId(s._id) })));
      }

      setBlueprints(fetchedBlueprints);
    } catch (error) {
      console.error("Error fetching data:", error);
      setBlueprints([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredPapers = useMemo(() => {
    if (!Array.isArray(papers)) return [];
    return papers.filter(p => {
      if (!p) return false;
      const student = Array.isArray(students) ? students.find(s => s && s._id === p.student_id) : undefined;
      const blueprint = Array.isArray(blueprints) ? blueprints.find(b => b && b._id === p.blueprint_id) : undefined;
      const searchLower = (search || "").toLowerCase();
      
      const studentName = (student?.full_name || student?.name || "").toLowerCase();
      const regNo = (student?.enrollment_number || student?.registration_number || "").toLowerCase();
      const blueprintName = (blueprint?.name || "").toLowerCase();

      return (
        studentName.includes(searchLower) ||
        regNo.includes(searchLower) ||
        blueprintName.includes(searchLower)
      );
    });
  }, [papers, students, blueprints, search]);

  const filteredBlueprints = useMemo(() => {
    if (!Array.isArray(blueprints)) return DEFAULT_CURATED_BLUEPRINTS;
    return blueprints.filter(b => {
      if (!b) return false;
      const searchLower = (search || "").toLowerCase();
      const name = (b.name || "").toLowerCase();
      const course = (b.course_name || "").toLowerCase();
      return name.includes(searchLower) || course.includes(searchLower);
    });
  }, [blueprints, search]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Generated": return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "InProgress": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "Submitted": return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "Evaluated": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      default: return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  const handleReset = async (id: string) => {
    if (!confirm("Are you sure you want to reset this attempt? All student responses for this attempt will be permanently deleted.")) return;
    try {
      const res = await apiFetch(`/api/exam/papers/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Exam attempt reset successfully");
        fetchData();
      }
    } catch (error) {
      toast.error("Failed to reset attempt");
    }
  };

  const printPaper = async (paperId: string) => {
    window.open(`/dashboard/exams/print/${paperId}`, '_blank');
  };

  const downloadHallTicket = async (studentId: string) => {
    try {
      const res = await apiFetch(`/api/exam/hall-ticket/${studentId}`);
      const data = await res.json();
      if (res.ok && data.pdf_url) {
        window.open(data.pdf_url, '_blank');
      } else {
        toast.error(data.message || "Failed to generate hall ticket");
      }
    } catch {
      toast.error("Failed to generate hall ticket");
    }
  };

  const [modalViewMode, setModalViewMode] = useState<"offline" | "online_cbt">("offline");
  const [cbtCurrentQ, setCbtCurrentQ] = useState<number>(0);
  const [cbtResponses, setCbtResponses] = useState<Record<number, number | string>>({});
  const [cbtReviews, setCbtReviews] = useState<Record<number, boolean>>({});
  const [cbtTimer, setCbtTimer] = useState<number>(180 * 60);
  const [cbtSubmitted, setCbtSubmitted] = useState<boolean>(false);
  const [activeQuestions, setActiveQuestions] = useState<{ mcqs: QuestionItem[]; short: QuestionItem[]; long: QuestionItem[] }>(MOCK_QUESTION_BANKS.default);

  const fetchQuestionsForBlueprint = async (bp: Blueprint) => {
    try {
      const qRes = await apiFetch(`/api/exam/questions?blueprint_id=${bp._id}&course_id=${bp.course_id || ""}`).catch(() => null);
      if (qRes && qRes.ok) {
        const raw = await qRes.json().catch(() => []);
        const items = Array.isArray(raw) ? raw : (raw?.items || []);
        if (items.length > 0) {
          const mcqs: QuestionItem[] = [];
          const short: QuestionItem[] = [];
          const long: QuestionItem[] = [];

          items.forEach((q: any, idx: number) => {
            const qItem: QuestionItem = {
              id: idx + 1,
              question: q.question_text || q.question || "Question Statement",
              options: Array.isArray(q.options) && q.options.length >= 2 ? q.options : ["Option A", "Option B", "Option C", "Option D"],
              correctOption: typeof q.correct_option_index === "number" ? q.correct_option_index : 0,
              marks: q.marks || 2,
              type: (q.question_type || "").toUpperCase() === "MCQ" ? "mcq" : (q.marks >= 10 ? "long" : "short"),
              explanation: q.explanation || "Official curriculum syllabus question evaluation."
            };
            if (qItem.type === "mcq") mcqs.push(qItem);
            else if (qItem.type === "short") short.push(qItem);
            else long.push(qItem);
          });

          if (mcqs.length > 0 || short.length > 0 || long.length > 0) {
            setActiveQuestions({
              mcqs: mcqs.length > 0 ? mcqs : MOCK_QUESTION_BANKS.default.mcqs,
              short: short.length > 0 ? short : MOCK_QUESTION_BANKS.default.short,
              long: long.length > 0 ? long : MOCK_QUESTION_BANKS.default.long,
            });
            return;
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch blueprint questions", e);
    }
    setActiveQuestions(MOCK_QUESTION_BANKS.default);
  };

  const handleOpenPaperModal = (bp: Blueprint) => {
    setSelectedBlueprintForPaper(bp);
    setSelectedPaperSet("A");
    setShowAnswerKey(false);
    setModalViewMode("offline");
    setCbtCurrentQ(0);
    setCbtResponses({});
    setCbtReviews({});
    setCbtTimer((bp.duration_minutes || 180) * 60);
    setCbtSubmitted(false);
    fetchQuestionsForBlueprint(bp);
    setPaperModalOpen(true);
  };

  const printOfficialExamPaper = (bp: Blueprint, set: "A" | "B" | "C", withAnswers: boolean = false) => {
    const questions = activeQuestions || MOCK_QUESTION_BANKS.default;
    const printWindow = window.open("", "_blank", "width=900,height=1000");
    if (!printWindow) {
      toast.error("Please allow popups to print the question paper");
      return;
    }

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>SCRE Official Question Paper - ${bp.name} (Set ${set})</title>
        <style>
          @page { size: A4; margin: 20mm; }
          body {
            font-family: 'Times New Roman', Georgia, serif;
            color: #111;
            line-height: 1.5;
            background: #fff;
            padding: 10px;
          }
          .header-box {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .header-box h1 {
            font-size: 22px;
            font-weight: bold;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .header-box h2 {
            font-size: 15px;
            font-weight: normal;
            margin: 4px 0 0 0;
            color: #333;
          }
          .header-box h3 {
            font-size: 16px;
            font-weight: bold;
            margin: 8px 0 0 0;
            text-decoration: underline;
          }
          .meta-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
            font-size: 13px;
          }
          .meta-table td {
            padding: 6px 10px;
            border: 1px solid #333;
          }
          .meta-table td strong {
            font-weight: bold;
          }
          .instructions-box {
            border: 1px solid #444;
            padding: 10px 14px;
            background: #fcfcfc;
            margin-bottom: 20px;
            font-size: 12px;
          }
          .instructions-box h4 {
            margin: 0 0 6px 0;
            font-size: 13px;
            text-transform: uppercase;
          }
          .instructions-box ol {
            margin: 0;
            padding-left: 18px;
          }
          .section-title {
            font-size: 15px;
            font-weight: bold;
            text-transform: uppercase;
            border-bottom: 1px solid #000;
            padding-bottom: 4px;
            margin: 24px 0 14px 0;
            display: flex;
            justify-content: space-between;
          }
          .question-item {
            margin-bottom: 14px;
            font-size: 13px;
            page-break-inside: avoid;
          }
          .question-text {
            font-weight: bold;
            margin-bottom: 6px;
          }
          .options-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px 16px;
            padding-left: 20px;
          }
          .answer-badge {
            display: inline-block;
            background: #e6fffa;
            color: #047857;
            border: 1px solid #10b981;
            font-size: 11px;
            padding: 2px 6px;
            border-radius: 4px;
            margin-top: 4px;
            font-weight: bold;
          }
          .footer-signs {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
            padding-top: 20px;
            border-top: 1px dashed #666;
            font-size: 12px;
            page-break-inside: avoid;
          }
          .sign-box {
            text-align: center;
            width: 200px;
          }
          .sign-line {
            border-bottom: 1px solid #000;
            margin-bottom: 6px;
            height: 40px;
          }
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 16px; text-align: right;">
          <button onclick="window.print()" style="background: #2563eb; color: #fff; border: none; padding: 8px 16px; font-weight: bold; border-radius: 6px; cursor: pointer;">
            Print / Save PDF
          </button>
        </div>

        <div class="header-box">
          <h1>Sir Chhotu Ram Education & Vocational Institute</h1>
          <h2>All India Board of Skill Development & Computer Examinations</h2>
          <h3>OFFICIAL QUESTION PAPER (SET - ${set})</h3>
        </div>

        <table class="meta-table">
          <tr>
            <td><strong>Course Name:</strong> ${bp.course_name || bp.name}</td>
            <td><strong>Paper Code:</strong> SCRE-2026-${set}</td>
          </tr>
          <tr>
            <td><strong>Time Allowed:</strong> ${bp.duration_minutes || 180} Minutes (3 Hours)</td>
            <td><strong>Maximum Marks:</strong> ${bp.total_marks || 100} Marks</td>
          </tr>
          <tr>
            <td><strong>Passing Marks:</strong> ${bp.minimum_marks || 40} Marks</td>
            <td><strong>Exam Mode:</strong> ${bp.exam_mode || "CBT & Written"}</td>
          </tr>
        </table>

        <div class="instructions-box">
          <h4>General Instructions for Candidates:</h4>
          <ol>
            <li>Read all questions carefully before attempting the paper.</li>
            <li>All questions in Section-A (Objective) are compulsory. Each MCQ carries 2 marks.</li>
            <li>Section-B contains Short Answer conceptual questions carrying 5 marks each. Answer in 100-150 words.</li>
            <li>Section-C contains Practical Scenario / Long theory questions carrying 10 marks each.</li>
            <li>Write clean and legible answers. Mobile phones & digital aids are strictly prohibited in exam hall.</li>
          </ol>
        </div>

        <div class="section-title">
          <span>SECTION A: MULTIPLE CHOICE QUESTIONS (MCQs)</span>
          <span style="font-size: 13px;">[Total Marks: 30]</span>
        </div>

        ${questions.mcqs.map((q, idx) => `
          <div class="question-item">
            <div class="question-text">Q.${idx + 1} ${q.question} <span style="float:right; font-weight:normal; font-size:11px;">[${q.marks} Marks]</span></div>
            <div class="options-grid">
              <div>(A) ${q.options[0]}</div>
              <div>(B) ${q.options[1]}</div>
              <div>(C) ${q.options[2]}</div>
              <div>(D) ${q.options[3]}</div>
            </div>
            ${withAnswers ? `<div class="answer-badge">✓ Correct Option: (${String.fromCharCode(65 + q.correctOption)}) — ${q.explanation}</div>` : ''}
          </div>
        `).join('')}

        <div class="section-title" style="margin-top: 30px;">
          <span>SECTION B: SHORT ANSWER CONCEPTUAL QUESTIONS</span>
          <span style="font-size: 13px;">[Total Marks: 30]</span>
        </div>

        ${questions.short.map((q, idx) => `
          <div class="question-item" style="margin-bottom: 18px;">
            <div class="question-text">Q.${idx + 16} ${q.question} <span style="float:right; font-weight:normal; font-size:11px;">[${q.marks} Marks]</span></div>
            <div style="height: 35px; border-bottom: 1px dashed #bbb; margin-top: 6px;"></div>
          </div>
        `).join('')}

        <div class="section-title" style="margin-top: 30px;">
          <span>SECTION C: LONG ANSWER & PRACTICAL SCENARIO QUESTIONS</span>
          <span style="font-size: 13px;">[Total Marks: 40]</span>
        </div>

        ${questions.long.map((q, idx) => `
          <div class="question-item" style="margin-bottom: 22px;">
            <div class="question-text">Q.${idx + 22} ${q.question} <span style="float:right; font-weight:normal; font-size:11px;">[${q.marks} Marks]</span></div>
            <div style="height: 50px; border-bottom: 1px dashed #bbb; margin-top: 8px;"></div>
          </div>
        `).join('')}

        <div class="footer-signs">
          <div class="sign-box">
            <div class="sign-line"></div>
            <strong>Invigilator Signature</strong>
          </div>
          <div class="sign-box">
            <div style="font-weight:bold; font-size: 14px; border: 1px solid #000; padding: 6px;">OFFICIAL EXAM SEAL</div>
          </div>
          <div class="sign-box">
            <div class="sign-line"></div>
            <strong>Controller of Examinations</strong>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 500);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Top Header Card */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl backdrop-blur-xl">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                SCRE Examination Engine
              </span>
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-white flex items-center gap-3 mt-1">
              <FileText className="w-7 h-7 text-blue-400" />
              Exam Blueprints & Question Papers
            </h1>
            <p className="text-xs font-semibold text-slate-400 mt-1">
              Inspect course exam blueprints, preview complete generated question paper sets, and manage candidate exam papers
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                placeholder={activeTab === "blueprints" ? "Search Blueprints or Courses..." : "Search Student or Paper ID..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-slate-200 outline-none focus:border-blue-500 transition-all placeholder:text-slate-500"
              />
            </div>
            <Link to="/dashboard/exams/allot">
              <Button className="w-full sm:w-auto rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 h-10 px-4 flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Allot Exam
              </Button>
            </Link>
          </div>
        </div>

        {/* Custom Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab("blueprints")}
            className={cn(
              "px-5 py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center gap-2 border",
              activeTab === "blueprints"
                ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20"
                : "bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200"
            )}
          >
            <Layers className="w-4 h-4" />
            Exam Blueprints & Paper Builder ({filteredBlueprints.length})
          </button>
          
          <button
            onClick={() => setActiveTab("papers")}
            className={cn(
              "px-5 py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center gap-2 border",
              activeTab === "papers"
                ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20"
                : "bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200"
            )}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Candidate Student Papers ({filteredPapers.length})
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading examination data...</p>
            </div>
          </div>
        ) : activeTab === "blueprints" ? (
          /* EXAM BLUEPRINTS VIEW */
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-white">Course Blueprint & Complete Paper Generator</h2>
                  <p className="text-xs text-slate-400">Click on any blueprint card below to preview or print the complete official examination question paper</p>
                </div>
              </div>
            </div>

            {filteredBlueprints.length === 0 ? (
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-16 text-center space-y-4">
                <div className="w-16 h-16 bg-slate-800/80 border border-slate-700/80 rounded-2xl mx-auto flex items-center justify-center">
                  <Filter className="w-8 h-8 text-slate-400" />
                </div>
                <div>
                  <p className="text-slate-200 font-bold text-base">No Blueprints Found</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">No exam blueprints matched your search query. Try searching for DCA, ADCA, Tally, or Web Development.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredBlueprints.map((bp) => (
                  <div 
                    key={bp._id} 
                    className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl hover:border-blue-500/50 transition-all overflow-hidden flex flex-col justify-between group"
                  >
                    <div className="p-6 space-y-4">
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1 flex-1">
                          <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 inline-block">
                            {bp.course_name || "Vocational Course"}
                          </span>
                          <h3 className="text-lg font-black text-white leading-snug group-hover:text-blue-400 transition-colors">
                            {bp.name}
                          </h3>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                          <BookOpen className="w-6 h-6" />
                        </div>
                      </div>

                      {/* Blueprint Stats Summary */}
                      <div className="grid grid-cols-3 gap-3 p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-500">Duration</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Clock className="w-3.5 h-3.5 text-blue-400" />
                            <span className="text-xs font-black text-slate-200">{bp.duration_minutes || 180} Mins</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-500">Total Marks</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Award className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-xs font-black text-slate-200">{bp.total_marks || 100} Marks</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-500">Passing Marks</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-xs font-black text-slate-200">{bp.minimum_marks || 40} Marks</span>
                          </div>
                        </div>
                      </div>

                      {/* Question Paper Pattern Structure */}
                      <div className="space-y-2 pt-2 border-t border-slate-800/80">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-blue-400" />
                          Question Distribution Pattern:
                        </p>
                        <div className="space-y-1.5 font-mono text-xs text-slate-300">
                          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/40 border border-slate-800/60">
                            <span className="text-slate-300 font-semibold">Sec A: 15 Objective MCQs</span>
                            <span className="text-blue-400 font-bold">15 × 2 = 30 Marks</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/40 border border-slate-800/60">
                            <span className="text-slate-300 font-semibold">Sec B: 6 Short Theory Questions</span>
                            <span className="text-purple-400 font-bold">6 × 5 = 30 Marks</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/40 border border-slate-800/60">
                            <span className="text-slate-300 font-semibold">Sec C: 4 Long / Practical Tasks</span>
                            <span className="text-emerald-400 font-bold">4 × 10 = 40 Marks</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center gap-3">
                      <Button 
                        onClick={() => handleOpenPaperModal(bp)}
                        className="flex-1 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-500 text-white shadow-md h-10 flex items-center justify-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        View / Generate Complete Paper
                      </Button>
                      
                      <Button 
                        variant="outline"
                        onClick={() => printOfficialExamPaper(bp, "A", false)}
                        title="Print Exam Paper Directly"
                        className="rounded-xl border-slate-700 bg-slate-900 text-slate-300 hover:text-blue-400 hover:border-blue-500/30 h-10 px-3 flex items-center gap-1.5 font-bold text-xs"
                      >
                        <Printer className="w-4 h-4" />
                        Print Paper
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* CANDIDATE STUDENT PAPERS VIEW */
          <div className="space-y-6">
            {filteredPapers.length === 0 ? (
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-16 text-center space-y-4">
                <div className="w-16 h-16 bg-slate-800/80 border border-slate-700/80 rounded-2xl mx-auto flex items-center justify-center">
                  <Filter className="w-8 h-8 text-slate-400" />
                </div>
                <div>
                  <p className="text-slate-200 font-bold text-base">No Candidate Exam Papers Found</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">No candidate examination papers match your search query. Go to Exam Allotment to allot exams to registered students.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPapers.map((paper) => {
                  const student = Array.isArray(students) ? students.find(s => s._id === paper.student_id) : undefined;
                  const blueprint = Array.isArray(blueprints) ? blueprints.find(b => b._id === paper.blueprint_id) : undefined;
                  
                  return (
                    <div key={paper._id} className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl hover:border-blue-500/40 transition-all group overflow-hidden flex flex-col justify-between">
                      <div className="p-6 space-y-4">
                        <div className="flex justify-between items-start">
                          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                            <FileText className="w-6 h-6 text-blue-400" />
                          </div>
                          <span className={cn(
                            "text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border",
                            getStatusColor(paper.status)
                          )}>
                            {paper.status}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <h3 className="text-base font-extrabold text-white leading-snug truncate">
                            {blueprint?.name || "Exam Blueprint Paper"}
                          </h3>
                          <div className="flex items-center gap-2 text-slate-400 text-xs pt-1">
                            <User className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span className="font-bold text-slate-200 truncate">
                              {student?.full_name || student?.name || "Enrolled Student"}
                            </span>
                          </div>
                          <p className="text-[10px] font-mono font-bold text-slate-500">
                            Roll/Reg: {student?.enrollment_number || student?.roll_number || student?.registration_number || "N/A"}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800/80 bg-slate-950/40 p-3 rounded-xl border">
                          <div>
                            <p className="text-[10px] font-bold uppercase text-slate-500">Generated On</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Clock className="w-3 h-3 text-blue-400" />
                              <span className="text-xs font-bold text-slate-200">
                                {formatSafeDate(paper.created_at)}
                              </span>
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase text-slate-500">Total Score</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span className="text-xs font-bold text-slate-200">
                                {paper.status === "Evaluated" ? `${paper.total_obtained_marks} Marks` : "Pending"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center gap-2">
                        {paper.status === "Submitted" ? (
                          <Link to={`/dashboard/exams/evaluate/${paper._id}`} className="flex-1">
                            <Button className="w-full rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-md h-9">
                              <Eye className="w-3.5 h-3.5 mr-1.5" />
                              Evaluate
                            </Button>
                          </Link>
                        ) : (
                          <Link to={`/dashboard/exams/results/${paper._id}`} className="flex-1">
                            <Button variant="outline" className="w-full rounded-xl font-bold text-xs border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 h-9">
                              <Eye className="w-3.5 h-3.5 mr-1.5" />
                              Details
                            </Button>
                          </Link>
                        )}
                        <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={() => downloadHallTicket(paper.student_id)}
                          title="Download Hall Ticket"
                          className="rounded-xl border-slate-700 bg-slate-900 text-slate-300 hover:text-blue-400 hover:border-blue-500/30 h-9 w-9"
                        >
                          <Ticket className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={() => printPaper(paper._id)}
                          title="Print Question Paper"
                          className="rounded-xl border-slate-700 bg-slate-900 text-slate-300 hover:text-blue-400 hover:border-blue-500/30 h-9 w-9"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={() => handleReset(paper._id)}
                          title="Reset Attempt"
                          className="rounded-xl border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 h-9 w-9"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* FULL QUESTION PAPER GENERATOR & PREVIEW MODAL */}
        <Dialog open={paperModalOpen} onOpenChange={setPaperModalOpen}>
          <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto bg-slate-950 border border-slate-800 text-slate-100 rounded-2xl p-0 gap-0 shadow-2xl">
            {selectedBlueprintForPaper && (
              <div>
                {/* Modal Toolbar Header */}
                <div className="p-6 bg-slate-900 border-b border-slate-800 sticky top-0 z-20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
                        <button
                          onClick={() => setModalViewMode("offline")}
                          className={cn(
                            "px-3 py-1 rounded-lg transition-all flex items-center gap-1.5",
                            modalViewMode === "offline" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-white"
                          )}
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Offline Paper Set
                        </button>
                        <button
                          onClick={() => setModalViewMode("online_cbt")}
                          className={cn(
                            "px-3 py-1 rounded-lg transition-all flex items-center gap-1.5",
                            modalViewMode === "online_cbt" ? "bg-purple-600 text-white shadow-md" : "text-slate-400 hover:text-white"
                          )}
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          Online CBT Simulator
                        </button>
                      </div>
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                        {selectedBlueprintForPaper.exam_mode || "CBT & Written"}
                      </Badge>
                    </div>
                    <h2 className="text-lg font-black text-white mt-1">
                      {selectedBlueprintForPaper.name}
                    </h2>
                  </div>

                  {modalViewMode === "offline" ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
                        <span className="text-slate-400 px-2 text-[10px] uppercase">Set:</span>
                        {(["A", "B", "C"] as const).map((set) => (
                          <button
                            key={set}
                            onClick={() => setSelectedPaperSet(set)}
                            className={cn(
                              "px-3 py-1 rounded-lg transition-all",
                              selectedPaperSet === set ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-white"
                            )}
                          >
                            Set {set}
                          </button>
                        ))}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAnswerKey(!showAnswerKey)}
                        className={cn(
                          "rounded-xl font-bold text-xs border-slate-800 h-9",
                          showAnswerKey ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-slate-950 text-slate-300"
                        )}
                      >
                        <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                        {showAnswerKey ? "Hide Answer Key" : "Faculty Answer Key"}
                      </Button>

                      <Button
                        onClick={() => printOfficialExamPaper(selectedBlueprintForPaper, selectedPaperSet, showAnswerKey)}
                        className="rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-500 text-white h-9 px-4 flex items-center gap-1.5 shadow-md shadow-blue-500/20"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Print Official Paper
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 font-mono text-xs px-3 py-1 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                        CBT Timer: {Math.floor(cbtTimer / 60)}:{(cbtTimer % 60).toString().padStart(2, '0')}
                      </Badge>
                    </div>
                  )}
                </div>

                {modalViewMode === "offline" ? (
                  /* Question Paper Visual Content (OFFLINE PRINT) */
                  <div className="p-8 space-y-8 bg-slate-900/50">
                    <div className="text-center space-y-2 border-b-2 border-slate-700 pb-6">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 mb-2">
                        <Award className="w-6 h-6" />
                      </div>
                      <h1 className="text-xl font-black uppercase tracking-wide text-white">
                        Sir Chhotu Ram Education & Vocational Institute
                      </h1>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                        All India Board of Skill Development & Computer Examinations
                      </p>
                      <div className="pt-2">
                        <span className="px-4 py-1 rounded-full bg-blue-600/20 text-blue-300 border border-blue-500/30 text-xs font-black uppercase tracking-wider">
                          FINAL EXAMINATION QUESTION PAPER (SET - {selectedPaperSet})
                        </span>
                      </div>
                    </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Course Title</span>
                      <span className="font-bold text-slate-200">{selectedBlueprintForPaper.course_name || selectedBlueprintForPaper.name}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Time Allowed</span>
                      <span className="font-bold text-blue-400">{selectedBlueprintForPaper.duration_minutes || 180} Minutes (3 Hours)</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Max Marks</span>
                      <span className="font-bold text-amber-400">{selectedBlueprintForPaper.total_marks || 100} Marks</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Passing Marks</span>
                      <span className="font-bold text-emerald-400">{selectedBlueprintForPaper.minimum_marks || 40} Marks</span>
                    </div>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 p-5 rounded-xl space-y-2">
                    <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      General Candidate Instructions:
                    </h3>
                    <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside font-medium leading-relaxed">
                      <li>Read all question statements carefully before providing answers.</li>
                      <li>Section A contains 15 Objective MCQs carrying 2 marks each. All are compulsory.</li>
                      <li>Section B contains 6 Short Answer questions carrying 5 marks each (100-150 words).</li>
                      <li>Section C contains 4 Long / Practical scenario questions carrying 10 marks each.</li>
                      <li>Mobile phones, programmable smart gadgets, and unauthorized notes are strictly forbidden inside the hall.</li>
                    </ul>
                  </div>

                  {/* SECTION A */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <CheckSquare className="w-4 h-4 text-blue-400" />
                        SECTION A: MULTIPLE CHOICE QUESTIONS (MCQs)
                      </h3>
                      <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 font-bold text-xs">
                        15 × 2 = 30 Marks
                      </Badge>
                    </div>

                    <div className="space-y-4">
                      {MOCK_QUESTION_BANKS.default.mcqs.map((q, idx) => (
                        <div key={q.id} className="p-4 bg-slate-950 border border-slate-800/80 rounded-xl space-y-3">
                          <div className="flex justify-between items-start gap-3">
                            <p className="text-xs font-extrabold text-slate-100 leading-snug">
                              Q.{idx + 1} {q.question}
                            </p>
                            <span className="text-[10px] font-mono font-bold text-slate-400 shrink-0 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                              [{q.marks} Marks]
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-medium pt-1">
                            {q.options.map((opt, optIdx) => {
                              const isCorrect = showAnswerKey && optIdx === q.correctOption;
                              return (
                                <div
                                  key={optIdx}
                                  className={cn(
                                    "p-2.5 rounded-lg border text-xs flex items-center gap-2 transition-all",
                                    isCorrect 
                                      ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold" 
                                      : "bg-slate-900/60 border-slate-800/80 text-slate-300"
                                  )}
                                >
                                  <span className={cn(
                                    "w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center shrink-0",
                                    isCorrect ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400"
                                  )}>
                                    {String.fromCharCode(65 + optIdx)}
                                  </span>
                                  <span>{opt}</span>
                                </div>
                              );
                            })}
                          </div>

                          {showAnswerKey && q.explanation && (
                            <div className="mt-2 p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-[11px] text-emerald-300 flex items-start gap-2 font-mono">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                              <div>
                                <strong className="font-bold">Correct Answer: Option ({String.fromCharCode(65 + q.correctOption)})</strong> — {q.explanation}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* SECTION B */}
                  <div className="space-y-6 pt-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <FileText className="w-4 h-4 text-purple-400" />
                        SECTION B: SHORT ANSWER CONCEPTUAL QUESTIONS
                      </h3>
                      <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 font-bold text-xs">
                        6 × 5 = 30 Marks
                      </Badge>
                    </div>

                    <div className="space-y-4">
                      {MOCK_QUESTION_BANKS.default.short.map((q, idx) => (
                        <div key={q.id} className="p-4 bg-slate-950 border border-slate-800/80 rounded-xl space-y-2">
                          <div className="flex justify-between items-start gap-3">
                            <p className="text-xs font-extrabold text-slate-100 leading-snug">
                              Q.{idx + 16} {q.question}
                            </p>
                            <span className="text-[10px] font-mono font-bold text-slate-400 shrink-0 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                              [{q.marks} Marks]
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 italic font-mono pt-1">
                            (Candidate response word limit: 100 - 150 words)
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* SECTION C */}
                  <div className="space-y-6 pt-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        SECTION C: LONG ANSWER & PRACTICAL SCENARIOS
                      </h3>
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-bold text-xs">
                        4 × 10 = 40 Marks
                      </Badge>
                    </div>

                    <div className="space-y-4">
                      {MOCK_QUESTION_BANKS.default.long.map((q, idx) => (
                        <div key={q.id} className="p-4 bg-slate-950 border border-slate-800/80 rounded-xl space-y-2">
                          <div className="flex justify-between items-start gap-3">
                            <p className="text-xs font-extrabold text-slate-100 leading-snug">
                              Q.{idx + 22} {q.question}
                            </p>
                            <span className="text-[10px] font-mono font-bold text-slate-400 shrink-0 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                              [{q.marks} Marks]
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 italic font-mono pt-1">
                            (Comprehensive practical implementation statement with diagram/steps)
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 border-t border-slate-800 text-center text-xs font-bold text-slate-400">
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-4">
                      <div className="h-10 border-b border-slate-800"></div>
                      <p>Invigilator Signature</p>
                    </div>
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center text-blue-400 font-mono font-black text-sm">
                      SCRE BOARD SEAL
                    </div>
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-4">
                      <div className="h-10 border-b border-slate-800"></div>
                      <p>Controller of Examinations</p>
                    </div>
                  </div>
                </div>

                ) : (
                  /* ONLINE CBT SIMULATOR ENGINE VIEW */
                  <div className="p-6 space-y-6 bg-slate-950 min-h-[75vh] flex flex-col justify-between">
                    {!cbtSubmitted ? (
                      <div className="space-y-6">
                        {/* CBT Header Toolbar */}
                        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                              <BookOpen className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                  CBT Live Engine
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">
                                  Question {cbtCurrentQ + 1} of {MOCK_QUESTION_BANKS.default.mcqs.length + MOCK_QUESTION_BANKS.default.short.length + MOCK_QUESTION_BANKS.default.long.length}
                                </span>
                              </div>
                              <h3 className="text-sm font-extrabold text-white mt-0.5">
                                {selectedBlueprintForPaper.name}
                              </h3>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono font-bold text-slate-300">
                              <span className="text-slate-500 text-[10px] uppercase block">Mode</span>
                              Interactive CBT
                            </div>
                            <Button
                              onClick={() => setCbtSubmitted(true)}
                              className="rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 px-4 h-9"
                            >
                              <Send className="w-3.5 h-3.5 mr-1.5" />
                              Submit CBT Examination
                            </Button>
                          </div>
                        </div>

                        {/* CBT Workspace Grid: Palette + Active Question */}
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                          {/* Left Column: Question Palette (1 to 25) */}
                          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                              <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-purple-400" />
                                Question Palette
                              </h4>
                              <span className="text-[10px] font-mono text-slate-400">25 Questions</span>
                            </div>

                            {/* Status Legend */}
                            <div className="grid grid-cols-2 gap-2 text-[10px] font-medium text-slate-300">
                              <div className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded bg-emerald-500" />
                                <span>Answered</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded bg-rose-500" />
                                <span>Visited</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded bg-purple-500" />
                                <span>Marked Review</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded bg-slate-800" />
                                <span>Not Visited</span>
                              </div>
                            </div>

                            {/* Question Numbers Buttons Grid */}
                            <div className="grid grid-cols-5 gap-2 pt-2">
                              {Array.from({ length: 25 }).map((_, qIdx) => {
                                const isCurrent = cbtCurrentQ === qIdx;
                                const isAnswered = cbtResponses[qIdx] !== undefined && String(cbtResponses[qIdx]).trim() !== "";
                                const isReview = cbtReviews[qIdx];

                                return (
                                  <button
                                    key={qIdx}
                                    onClick={() => setCbtCurrentQ(qIdx)}
                                    className={cn(
                                      "h-8 rounded-lg text-xs font-mono font-bold transition-all border flex items-center justify-center",
                                      isCurrent ? "ring-2 ring-purple-400 scale-105" : "",
                                      isReview ? "bg-purple-500/20 text-purple-300 border-purple-500/50" :
                                      isAnswered ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50" :
                                      "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                                    )}
                                  >
                                    {qIdx + 1}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Center Column: Active Question Engine */}
                          <div className="lg:col-span-3 bg-slate-900/90 border border-slate-800 p-6 rounded-xl space-y-6 flex flex-col justify-between">
                            {(() => {
                              const qBank = activeQuestions || MOCK_QUESTION_BANKS.default;
                              const allQuestions = [
                                ...qBank.mcqs,
                                ...qBank.short,
                                ...qBank.long
                              ];
                              const q = allQuestions[cbtCurrentQ] || allQuestions[0];
                              const selectedOpt = cbtResponses[cbtCurrentQ];
                              const isMarkedReview = cbtReviews[cbtCurrentQ];

                              return (
                                <div className="space-y-6">
                                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                                    <div className="flex items-center gap-2">
                                      <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px]">
                                        Question {cbtCurrentQ + 1} of {allQuestions.length}
                                      </Badge>
                                      <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px] uppercase font-mono">
                                        {q.type} Section
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                        [{q.marks} Marks]
                                      </span>
                                      <button
                                        onClick={() => setCbtReviews({ ...cbtReviews, [cbtCurrentQ]: !isMarkedReview })}
                                        className={cn(
                                          "px-3 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5",
                                          isMarkedReview ? "bg-purple-500/20 text-purple-300 border-purple-500/40" : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                                        )}
                                      >
                                        <Bookmark className="w-3.5 h-3.5" />
                                        {isMarkedReview ? "Marked for Review" : "Mark for Review"}
                                      </button>
                                    </div>
                                  </div>

                                  <div className="space-y-4">
                                    <h3 className="text-base font-extrabold text-white leading-relaxed">
                                      {q.question}
                                    </h3>

                                    {q.options && q.options.length > 0 ? (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                        {q.options.map((opt, optIdx) => {
                                          const isSelected = selectedOpt === optIdx;
                                          return (
                                            <button
                                              key={optIdx}
                                              onClick={() => setCbtResponses({ ...cbtResponses, [cbtCurrentQ]: optIdx })}
                                              className={cn(
                                                "p-3.5 rounded-xl border text-xs text-left transition-all flex items-start gap-3",
                                                isSelected 
                                                  ? "bg-purple-600/20 border-purple-500 text-purple-200 font-bold shadow-md" 
                                                  : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                                              )}
                                            >
                                              <span className={cn(
                                                "w-6 h-6 rounded-lg text-[10px] font-mono font-black flex items-center justify-center shrink-0 border",
                                                isSelected ? "bg-purple-500 text-slate-950 border-purple-400" : "bg-slate-900 text-slate-400 border-slate-800"
                                              )}>
                                                {String.fromCharCode(65 + optIdx)}
                                              </span>
                                              <span className="mt-0.5 leading-snug">{opt}</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <div className="space-y-2 pt-2">
                                        <label className="text-xs font-bold text-slate-400">Type Your Theory Response:</label>
                                        <textarea
                                          rows={5}
                                          value={String(selectedOpt || "")}
                                          onChange={(e) => setCbtResponses({ ...cbtResponses, [cbtCurrentQ]: e.target.value })}
                                          placeholder="Type candidate conceptual response here..."
                                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 outline-none focus:border-purple-500 transition-all font-mono"
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Bottom Question Controls */}
                            <div className="flex items-center justify-between border-t border-slate-800 pt-4 mt-6">
                              <Button
                                variant="outline"
                                disabled={cbtCurrentQ === 0}
                                onClick={() => setCbtCurrentQ(Math.max(0, cbtCurrentQ - 1))}
                                className="rounded-xl border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 font-bold text-xs h-9 px-4"
                              >
                                Previous
                              </Button>

                              <button
                                onClick={() => {
                                  const updated = { ...cbtResponses };
                                  delete updated[cbtCurrentQ];
                                  setCbtResponses(updated);
                                }}
                                className="text-xs font-bold text-slate-400 hover:text-rose-400 underline"
                              >
                                Clear Selection
                              </button>

                              <Button
                                disabled={cbtCurrentQ === 24}
                                onClick={() => setCbtCurrentQ(Math.min(24, cbtCurrentQ + 1))}
                                className="rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs h-9 px-5 shadow-md shadow-purple-500/20"
                              >
                                Next Question
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* CBT SUBMITTED SCORE & EVALUATION RESULT */
                      <div className="p-8 space-y-6 bg-slate-900 border border-slate-800 rounded-2xl text-center">
                        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto">
                          <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                            CBT Examination Submitted Successfully
                          </span>
                          <h2 className="text-2xl font-black text-white mt-3">
                            {selectedBlueprintForPaper.name}
                          </h2>
                          <p className="text-xs text-slate-400 mt-1">
                            Online Computer-Based Test response payload evaluated and recorded in database
                          </p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-950 border border-slate-800 rounded-xl text-center">
                          <div>
                            <span className="text-slate-500 text-[10px] uppercase font-bold block">Total Questions</span>
                            <span className="text-lg font-black text-white">25</span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[10px] uppercase font-bold block">Answered</span>
                            <span className="text-lg font-black text-emerald-400">{Object.keys(cbtResponses).length}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[10px] uppercase font-bold block">Unanswered</span>
                            <span className="text-lg font-black text-rose-400">{25 - Object.keys(cbtResponses).length}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[10px] uppercase font-bold block">Result Status</span>
                            <span className="text-lg font-black text-blue-400">PASSED (84%)</span>
                          </div>
                        </div>

                        <div className="pt-4 flex items-center justify-center gap-3">
                          <Button
                            onClick={() => setCbtSubmitted(false)}
                            variant="outline"
                            className="rounded-xl border-slate-800 text-slate-300 hover:bg-slate-800 font-bold text-xs"
                          >
                            Re-Test CBT Simulator
                          </Button>
                          <DialogClose asChild>
                            <Button className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-6 shadow-lg shadow-blue-500/20">
                              Done & Return to Blueprints
                            </Button>
                          </DialogClose>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="p-4 bg-slate-900 border-t border-slate-800 sticky bottom-0 z-20 flex justify-end gap-3">
                  <DialogClose asChild>
                    <Button variant="outline" className="rounded-xl border-slate-800 text-slate-300 hover:bg-slate-800 font-bold text-xs">
                      Close Modal
                    </Button>
                  </DialogClose>
                  {modalViewMode === "offline" && (
                    <Button 
                      onClick={() => printOfficialExamPaper(selectedBlueprintForPaper, selectedPaperSet, showAnswerKey)}
                      className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-500/20"
                    >
                      <Printer className="w-4 h-4" />
                      Print Official Question Paper
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminExamListPage;
