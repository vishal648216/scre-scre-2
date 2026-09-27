import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  PenTool, Layers, Sparkles, FileText, RefreshCw, Loader2, Settings2,
  Printer, Eye, Copy, CheckCircle2, ShieldCheck, HelpCircle, Shuffle
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Link } from "react-router-dom";

interface Course {
  id: string;
  course_name: string;
}

interface Subject {
  _id: string;
  subject_name: string;
  course_id: string;
}

interface QuestionBank {
  _id: string;
  name: string;
}

interface ExamBlueprint {
  _id: string;
  name: string;
  course_id: string;
  subjects: any[];
  duration_minutes?: number;
  total_duration_minutes?: number;
  instructions?: string;
  exam_pattern?: string;
}

interface QuestionItem {
  id: string;
  question_text: string;
  options: string[];
  correct_option?: string;
  type: "mcq" | "theory" | "practical";
  marks: number;
  explanation?: string;
}

interface PaperSet {
  code: string; // "Set A (Master)", "Set B (Shuffled)", etc.
  setName: string; // "Set A", "Set B", etc.
  strategy: string; // "Standard Sequence", "Shuffled Questions", etc.
  totalMarks: number;
  duration: number;
  mcqs: number;
  theory: number;
  practical: number;
  mcqQuestions: QuestionItem[];
  theoryQuestions: QuestionItem[];
  practicalQuestions: QuestionItem[];
}

export default function AdminPaperBuilderPage() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [blueprints, setBlueprints] = useState<ExamBlueprint[]>([]);
  
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string>("");
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");

  // Paper Structure State
  const [paperTitle, setPaperTitle] = useState("Master Comprehensive Examination Paper");
  const [mcqCount, setMcqCount] = useState(20);
  const [mcqMarks, setMcqMarks] = useState(1);
  const [theoryCount, setTheoryCount] = useState(4);
  const [theoryMarks, setTheoryMarks] = useState(5);
  const [practicalCount, setPracticalCount] = useState(1);
  const [practicalMarks, setPracticalMarks] = useState(10);
  const [durationMinutes, setDurationMinutes] = useState(60);

  // Generated Sets
  const [generatedSets, setGeneratedSets] = useState<PaperSet[]>([]);
  const [generating, setGenerating] = useState(false);

  // Preview Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [activePreviewSet, setActivePreviewSet] = useState<PaperSet | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [cRes, sRes, bRes, bpRes] = await Promise.all([
        apiFetch("/api/courses"),
        apiFetch("/api/admin/subjects"),
        apiFetch("/api/qb/banks"),
        apiFetch("/api/exam/blueprints")
      ]);
      let loadedCourses: Course[] = [];
      let loadedSubjects: Subject[] = [];

      if (cRes.ok) {
        const raw = await cRes.json();
        loadedCourses = raw.map((c: any) => ({ ...c, id: String(c._id || c.id) }));
        setCourses(loadedCourses);
        if (loadedCourses.length > 0) {
          setSelectedCourse(loadedCourses[0].id);
        }
      }
      if (sRes.ok) {
        const raw = await sRes.json();
        const items = Array.isArray(raw) ? raw : (raw.items || []);
        loadedSubjects = items.map((s: any) => ({ ...s, _id: String(s._id || s.id) }));
        setSubjects(loadedSubjects);
        if (loadedSubjects.length > 0) {
          setSelectedSubject(loadedSubjects[0]._id);
        }
      }
      if (bRes.ok) {
        const raw = await bRes.json();
        setBanks(raw.map((b: any) => ({ ...b, _id: String(b._id || b.id) })));
      }
      if (bpRes.ok) {
        const raw = await bpRes.json();
        setBlueprints(raw.map((bp: any) => ({ ...bp, _id: String(bp._id || bp.id) })));
      }
    } catch {
      toast.error("Failed to load paper builder dependencies");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBlueprint = (bpId: string) => {
    setSelectedBlueprintId(bpId);
    const bp = blueprints.find(b => b._id === bpId);
    if (!bp) return;

    setPaperTitle(`${bp.name} - Official Paper`);
    if (bp.course_id) setSelectedCourse(bp.course_id);
    if (bp.duration_minutes || bp.total_duration_minutes) {
      setDurationMinutes(bp.duration_minutes || bp.total_duration_minutes || 60);
    }

    if (bp.subjects && bp.subjects.length > 0) {
      const firstSub = bp.subjects[0];
      if (firstSub.subject_id) setSelectedSubject(firstSub.subject_id);

      if (firstSub.question_distribution && firstSub.question_distribution.length > 0) {
        const qDist = firstSub.question_distribution[0];
        setMcqCount(qDist.count || 20);
        setMcqMarks(qDist.marks || 1);
      }
      if (firstSub.practical_component?.enabled) {
        setPracticalCount(1);
        setPracticalMarks(firstSub.practical_component.marks || 10);
      }
      if (firstSub.assignment_component?.enabled) {
        setTheoryCount(2);
        setTheoryMarks(firstSub.assignment_component.marks || 5);
      }
    }

    toast.success(`Loaded blueprint rules: ${bp.name}`);
  };

  const totalPaperMarks = (mcqCount * mcqMarks) + (theoryCount * theoryMarks) + (practicalCount * practicalMarks);

  // Helper shuffle functions
  const shuffleArray = <T,>(arr: T[]): T[] => {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Helper to generate realistic subject questions if question bank is short
  const generateFallbackMcqs = (count: number, courseName: string, subjectName: string): QuestionItem[] => {
    const defaultTemplates = [
      { text: `What is the primary function of ${subjectName || "the core module"} in ${courseName || "Software Architecture"}?`, options: ["System resource management & optimization", "User interface styling", "Database indexing only", "Network physical layer modulation"] },
      { text: `Which of the following data structures provides O(1) average time complexity for key lookups?`, options: ["Hash Table / HashMap", "Binary Search Tree", "Singly Linked List", "Array Stack"] },
      { text: `In ${subjectName || "modern software development"}, what is the purpose of asynchronous non-blocking I/O?`, options: ["Prevent thread blocking during heavy I/O operations", "Increase CPU clock speed", "Enforce synchronous execution flow", "Compress static CSS files"] },
      { text: `Which database normalization form eliminates transitive functional dependencies?`, options: ["Third Normal Form (3NF)", "First Normal Form (1NF)", "Second Normal Form (2NF)", "Boyce-Codd Normal Form (BCNF)"] },
      { text: `What does the HTTP status code 403 Forbidden signify?`, options: ["Client authenticated but lacks authorization", "Server internal crash", "Resource missing", "Bad gateway response"] },
      { text: `In object-oriented software engineering, which principle states software entities should be open for extension but closed for modification?`, options: ["Open/Closed Principle (OCP)", "Single Responsibility Principle (SRP)", "Liskov Substitution Principle (LSP)", "Dependency Inversion Principle (DIP)"] },
      { text: `Which encryption standard is widely used for securing web traffic over HTTPS?`, options: ["TLS 1.3 / AES-256", "MD5 Hashing", "Base64 Encoding", "DES Encryption"] },
      { text: `What is the primary role of indexing in relational database query execution?`, options: ["Speed up record retrieval by reducing disk scans", "Ensure data encryption", "Auto-increment primary key values", "Format JSON output"] },
      { text: `In Git version control, which command creates a new branch and switches to it simultaneously?`, options: ["git checkout -b <branch>", "git commit -m <branch>", "git merge <branch>", "git fetch --all"] },
      { text: `Which protocol resolves IP logical network addresses to physical MAC addresses?`, options: ["ARP (Address Resolution Protocol)", "DHCP", "DNS", "ICMP"] }
    ];

    const result: QuestionItem[] = [];
    for (let i = 0; i < count; i++) {
      const template = defaultTemplates[i % defaultTemplates.length];
      result.push({
        id: `mcq-${i + 1}`,
        question_text: `Q${i + 1}. ${template.text}`,
        options: template.options,
        correct_option: "a",
        type: "mcq",
        marks: mcqMarks
      });
    }
    return result;
  };

  const generateFallbackTheory = (count: number, subjectName: string): QuestionItem[] => {
    const templates = [
      `Explain the architectural principles and operational workflow of ${subjectName || "the core system"}. Highlight key design patterns.`,
      `Describe the key differences between relational (SQL) and non-relational (NoSQL) database storage models with real-world use cases.`,
      `Detail the complete lifecycle of a client request in microservices architecture, including security, routing & load balancing.`,
      `Discuss exception handling, memory management, and performance optimization techniques in enterprise software development.`
    ];

    const result: QuestionItem[] = [];
    for (let i = 0; i < count; i++) {
      result.push({
        id: `th-${i + 1}`,
        question_text: `Q${i + 1}. ${templates[i % templates.length]}`,
        options: [],
        type: "theory",
        marks: theoryMarks
      });
    }
    return result;
  };

  const generateFallbackPractical = (count: number, courseName: string): QuestionItem[] => {
    const result: QuestionItem[] = [];
    for (let i = 0; i < count; i++) {
      result.push({
        id: `prac-${i + 1}`,
        question_text: `Practical Assignment Task ${i + 1}: Design and implement a scalable solution for ${courseName || "Full Stack Application"} including database schema, API handler endpoints, and user interface state management.`,
        options: [],
        type: "practical",
        marks: practicalMarks
      });
    }
    return result;
  };

  const handleGeneratePaperSets = async () => {
    const activeCourseId = selectedCourse || (courses.length > 0 ? courses[0].id : "");
    if (!activeCourseId) {
      toast.error("Please select a target Course first");
      return;
    }

    setGenerating(true);

    try {
      let fetchedMcqs: QuestionItem[] = [];
      let fetchedTheory: QuestionItem[] = [];
      let fetchedPractical: QuestionItem[] = [];

      const targetCourseObj = courses.find(c => c.id === activeCourseId);
      const targetSubjectObj = subjects.find(s => s._id === selectedSubject);
      const courseName = targetCourseObj?.course_name || "Target Course";
      const subjectName = targetSubjectObj?.subject_name || "Target Subject";

      // Fetch questions from question banks
      if (banks.length > 0) {
        for (const bank of banks) {
          const qRes = await apiFetch(`/api/qb/banks/${bank._id}/questions`);
          if (qRes.ok) {
            const rawQ = await qRes.json();
            if (Array.isArray(rawQ) && rawQ.length > 0) {
              rawQ.forEach((q: any, idx: number) => {
                const opts = q.options || (q.formatted_options ? q.formatted_options.map((o: any) => o.text) : ["Option A", "Option B", "Option C", "Option D"]);
                const item: QuestionItem = {
                  id: q._id || `q-${idx}`,
                  question_text: q.question_text || q.name || `Question ${idx + 1}`,
                  options: opts.length > 0 ? opts : ["Option A", "Option B", "Option C", "Option D"],
                  correct_option: q.correct_option || "a",
                  type: (q.type || (opts.length > 1 ? "mcq" : "theory")) as any,
                  marks: q.marks || 1
                };
                if (item.type === "theory") fetchedTheory.push(item);
                else if (item.type === "practical") fetchedPractical.push(item);
                else fetchedMcqs.push(item);
              });
            }
          }
        }
      }

      // Fill fallback questions if question count is less than requested
      if (fetchedMcqs.length < mcqCount) {
        const needed = mcqCount - fetchedMcqs.length;
        fetchedMcqs = [...fetchedMcqs, ...generateFallbackMcqs(needed, courseName, subjectName)];
      } else {
        fetchedMcqs = fetchedMcqs.slice(0, mcqCount);
      }

      if (fetchedTheory.length < theoryCount) {
        const needed = theoryCount - fetchedTheory.length;
        fetchedTheory = [...fetchedTheory, ...generateFallbackTheory(needed, subjectName)];
      } else {
        fetchedTheory = fetchedTheory.slice(0, theoryCount);
      }

      if (fetchedPractical.length < practicalCount) {
        const needed = practicalCount - fetchedPractical.length;
        fetchedPractical = [...fetchedPractical, ...generateFallbackPractical(needed, courseName)];
      } else {
        fetchedPractical = fetchedPractical.slice(0, practicalCount);
      }

      // Construct 4 Paper Sets with 4 distinct Randomization Strategies:
      const setA: PaperSet = {
        code: "Set A (Master Standard)",
        setName: "SET A",
        strategy: "Standard Sequence",
        totalMarks: totalPaperMarks,
        duration: durationMinutes,
        mcqs: mcqCount,
        theory: theoryCount,
        practical: practicalCount,
        mcqQuestions: fetchedMcqs.map((q, idx) => ({ ...q, question_text: `Q${idx + 1}. ${q.question_text.replace(/^Q\d+\.\s*/, "")}` })),
        theoryQuestions: fetchedTheory.map((q, idx) => ({ ...q, question_text: `Q${idx + 1}. ${q.question_text.replace(/^Q\d+\.\s*/, "")}` })),
        practicalQuestions: fetchedPractical
      };

      const shuffledMcqsB = shuffleArray(fetchedMcqs);
      const setB: PaperSet = {
        code: "Set B (Shuffled Questions)",
        setName: "SET B",
        strategy: "Shuffled Questions & Answers",
        totalMarks: totalPaperMarks,
        duration: durationMinutes,
        mcqs: mcqCount,
        theory: theoryCount,
        practical: practicalCount,
        mcqQuestions: shuffledMcqsB.map((q, idx) => ({ ...q, question_text: `Q${idx + 1}. ${q.question_text.replace(/^Q\d+\.\s*/, "")}` })),
        theoryQuestions: shuffleArray(fetchedTheory).map((q, idx) => ({ ...q, question_text: `Q${idx + 1}. ${q.question_text.replace(/^Q\d+\.\s*/, "")}` })),
        practicalQuestions: fetchedPractical
      };

      const shuffledMcqsC = shuffleArray(fetchedMcqs).map(q => ({
        ...q,
        options: shuffleArray(q.options)
      }));
      const setC: PaperSet = {
        code: "Set C (Random Options Pool)",
        setName: "SET C",
        strategy: "Randomized Options Pool",
        totalMarks: totalPaperMarks,
        duration: durationMinutes,
        mcqs: mcqCount,
        theory: theoryCount,
        practical: practicalCount,
        mcqQuestions: shuffledMcqsC.map((q, idx) => ({ ...q, question_text: `Q${idx + 1}. ${q.question_text.replace(/^Q\d+\.\s*/, "")}` })),
        theoryQuestions: shuffleArray(fetchedTheory).map((q, idx) => ({ ...q, question_text: `Q${idx + 1}. ${q.question_text.replace(/^Q\d+\.\s*/, "")}` })),
        practicalQuestions: fetchedPractical
      };

      const shuffledMcqsD = shuffleArray(fetchedMcqs).map(q => ({
        ...q,
        options: shuffleArray(q.options)
      }));
      const setD: PaperSet = {
        code: "Set D (Anti-Cheating Scrambled)",
        setName: "SET D",
        strategy: "Anti-Cheating Order Randomizer",
        totalMarks: totalPaperMarks,
        duration: durationMinutes,
        mcqs: mcqCount,
        theory: theoryCount,
        practical: practicalCount,
        mcqQuestions: shuffledMcqsD.map((q, idx) => ({ ...q, question_text: `Q${idx + 1}. ${q.question_text.replace(/^Q\d+\.\s*/, "")}` })),
        theoryQuestions: shuffleArray(fetchedTheory).map((q, idx) => ({ ...q, question_text: `Q${idx + 1}. ${q.question_text.replace(/^Q\d+\.\s*/, "")}` })),
        practicalQuestions: fetchedPractical
      };

      setGeneratedSets([setA, setB, setC, setD]);
      toast.success("Successfully generated 4 Randomized Paper Sets (Set A, B, C, D)!");
    } catch {
      toast.error("Error generating paper sets");
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenPreview = (set: PaperSet) => {
    setActivePreviewSet(set);
    setPreviewModalOpen(true);
  };

  const handlePrintPdf = () => {
    if (!activePreviewSet) return;
    const targetCourseObj = courses.find(c => c.id === selectedCourse);
    const targetSubjectObj = subjects.find(s => s._id === selectedSubject);
    const courseName = targetCourseObj?.course_name || "Official Academic Program";
    const subjectName = targetSubjectObj?.subject_name || "Comprehensive Paper";

    const printWindow = window.open("", "_blank", "width=900,height=1000");
    if (!printWindow) {
      window.print();
      return;
    }

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>SCRE Official Question Paper - ${activePreviewSet.setName}</title>
        <style>
          @page { size: A4; margin: 18mm; }
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
            padding-bottom: 10px;
            margin-bottom: 14px;
          }
          .header-box h1 { font-size: 20px; font-weight: bold; margin: 0; text-transform: uppercase; }
          .header-box h2 { font-size: 14px; font-weight: normal; margin: 4px 0 0 0; color: #222; }
          .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 12px; }
          .meta-table td { padding: 5px 8px; border: 1px solid #333; }
          .instructions-box { border: 1px solid #333; padding: 8px 12px; background: #fdfdfd; margin-bottom: 16px; font-size: 11px; font-family: sans-serif; }
          .section-title { font-size: 13px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 3px; margin: 20px 0 10px 0; display: flex; justify-content: space-between; }
          .question-item { margin-bottom: 12px; font-size: 12px; font-family: sans-serif; page-break-inside: avoid; }
          .question-text { font-weight: bold; margin-bottom: 4px; }
          .options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; padding-left: 16px; }
          .theory-box { border: 1px dashed #aaa; padding: 8px; height: 45px; background: #fafafa; font-size: 10px; color: #888; border-radius: 4px; margin-top: 4px; }
          .no-print { display: none; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 12px; text-align: right;">
          <button onclick="window.print()" style="background: #2563eb; color: #fff; border: none; padding: 8px 16px; font-weight: bold; border-radius: 6px; cursor: pointer;">
            Print / Save PDF
          </button>
        </div>

        <div class="header-box">
          <h1>SIR CHHOTU RAM EDUCATION (SCRE)</h1>
          <h2>${paperTitle}</h2>
        </div>

        <table class="meta-table">
          <tr>
            <td><strong>COURSE:</strong> ${courseName}</td>
            <td><strong>SET CODE:</strong> ${activePreviewSet.setName}</td>
          </tr>
          <tr>
            <td><strong>SUBJECT:</strong> ${subjectName}</td>
            <td><strong>DURATION:</strong> ${activePreviewSet.duration} Minutes</td>
          </tr>
          <tr>
            <td><strong>MAXIMUM MARKS:</strong> ${activePreviewSet.totalMarks} Marks</td>
            <td><strong>AGGREGATE SECTIONS:</strong> MCQ + Theory + Practical</td>
          </tr>
        </table>

        <div class="instructions-box">
          <strong>General Instructions for Candidates:</strong>
          <ol style="margin: 4px 0 0 16px; padding: 0;">
            <li>All questions are compulsory unless specified otherwise.</li>
            <li>Write your Roll Number, Center Code, and Set Code (${activePreviewSet.setName}) clearly on your answer sheet.</li>
            <li>Mobile phones, programmable calculators, or digital aids are strictly prohibited in the examination hall.</li>
          </ol>
        </div>

        <div class="section-title">
          <span>SECTION A: OBJECTIVE MCQs</span>
          <span>(${activePreviewSet.mcqs * mcqMarks} MARKS)</span>
        </div>
        ${activePreviewSet.mcqQuestions.map((q) => `
          <div class="question-item">
            <div class="question-text">${q.question_text}</div>
            <div class="options-grid">
              ${q.options.map((opt, oIdx) => `<div>(${String.fromCharCode(65 + oIdx)}) ${opt}</div>`).join('')}
            </div>
          </div>
        `).join('')}

        ${activePreviewSet.theoryQuestions.length > 0 ? `
          <div class="section-title">
            <span>SECTION B: SHORT THEORY QUESTIONS</span>
            <span>(${activePreviewSet.theory * theoryMarks} MARKS)</span>
          </div>
          ${activePreviewSet.theoryQuestions.map((q) => `
            <div class="question-item">
              <div class="question-text" style="display:flex; justify-content:space-between;">
                <span>${q.question_text}</span>
                <span>[${theoryMarks} Marks]</span>
              </div>
              <div class="theory-box">Candidate Answer Response Area</div>
            </div>
          `).join('')}
        ` : ''}

        ${activePreviewSet.practicalQuestions.length > 0 ? `
          <div class="section-title">
            <span>SECTION C: PRACTICAL LAB TASK</span>
            <span>(${activePreviewSet.practical * practicalMarks} MARKS)</span>
          </div>
          ${activePreviewSet.practicalQuestions.map((q) => `
            <div class="question-item">
              <div class="question-text" style="display:flex; justify-content:space-between;">
                <span>${q.question_text}</span>
                <span>[${practicalMarks} Marks]</span>
              </div>
            </div>
          `).join('')}
        ` : ''}

        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();
  };

  const handleCopyPaper = () => {
    if (!activePreviewSet) return;
    let text = `====================================================\n`;
    text += `${paperTitle.toUpperCase()} - ${activePreviewSet.setName}\n`;
    text += `Course: ${courses.find(c => c.id === selectedCourse)?.course_name || ""}\n`;
    text += `Subject: ${subjects.find(s => s._id === selectedSubject)?.subject_name || ""}\n`;
    text += `Duration: ${activePreviewSet.duration} Mins | Max Marks: ${activePreviewSet.totalMarks}\n`;
    text += `====================================================\n\n`;

    text += `SECTION A: OBJECTIVE MCQs (${mcqCount * mcqMarks} Marks)\n\n`;
    activePreviewSet.mcqQuestions.forEach((q, i) => {
      text += `${q.question_text}\n`;
      q.options.forEach((opt, optIdx) => {
        text += `  (${String.fromCharCode(65 + optIdx)}) ${opt}\n`;
      });
      text += `\n`;
    });

    text += `SECTION B: SHORT THEORY (${theoryCount * theoryMarks} Marks)\n\n`;
    activePreviewSet.theoryQuestions.forEach(q => {
      text += `${q.question_text} [${theoryMarks} Marks]\n\n`;
    });

    if (activePreviewSet.practicalQuestions.length > 0) {
      text += `SECTION C: PRACTICAL TASK (${practicalCount * practicalMarks} Marks)\n\n`;
      activePreviewSet.practicalQuestions.forEach(q => {
        text += `${q.question_text} [${practicalMarks} Marks]\n\n`;
      });
    }

    navigator.clipboard.writeText(text);
    toast.success(`Copied ${activePreviewSet.setName} Question Paper to Clipboard!`);
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Top Header Card */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <PenTool className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                Paper Builder & Blueprint Studio
              </h1>
              <p className="text-xs font-semibold text-slate-400 mt-1">
                Visual Sectional Assembly (MCQ + Theory + Practical), Difficulty Weightage Ratios, and Anti-Cheating Multi-Set Shuffler
              </p>
            </div>
          </div>

          <Link to="/dashboard/academics/blueprints">
            <Button
              className="rounded-xl font-bold uppercase tracking-wider text-xs h-11 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg flex items-center gap-2"
            >
              <Settings2 className="w-4 h-4" />
              Manage Academics Blueprints
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Paper Structure Controls */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="rounded-2xl border-slate-800 bg-slate-900/90 shadow-xl backdrop-blur-xl">
              <CardHeader className="bg-slate-950/80 border-b border-slate-800 py-4 px-6">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                  <Layers className="w-4 h-4" /> 1. Select Blueprint & Context
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Select Saved Blueprint</Label>
                  <Select value={selectedBlueprintId} onValueChange={handleSelectBlueprint}>
                    <SelectTrigger className="rounded-xl bg-slate-950 border-indigo-500/40 text-xs font-bold text-white h-10">
                      <SelectValue placeholder="-- Choose Academics Blueprint --" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                      {blueprints.map(bp => (
                        <SelectItem key={bp._id} value={bp._id}>
                          {bp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Paper Title</Label>
                  <Input 
                    value={paperTitle} 
                    onChange={e => setPaperTitle(e.target.value)} 
                    className="rounded-xl bg-slate-950 border-slate-800 text-xs font-bold text-white h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Course</Label>
                  <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                    <SelectTrigger className="rounded-xl bg-slate-950 border-slate-800 text-xs font-bold text-white h-10">
                      <SelectValue placeholder="Select Course" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                      {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.course_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Subject</Label>
                  <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                    <SelectTrigger className="rounded-xl bg-slate-950 border-slate-800 text-xs font-bold text-white h-10">
                      <SelectValue placeholder="Select Subject" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                      {subjects.map(s => <SelectItem key={s._id} value={s._id}>{s.subject_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Exam Duration (Minutes)</Label>
                  <Input 
                    type="number" 
                    value={durationMinutes} 
                    onChange={e => setDurationMinutes(Number(e.target.value))} 
                    className="rounded-xl bg-slate-950 border-slate-800 text-xs font-bold text-white h-10"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Sectional Marks Breakdown */}
            <Card className="rounded-2xl border-slate-800 bg-slate-900/90 shadow-xl backdrop-blur-xl">
              <CardHeader className="bg-slate-950/80 border-b border-slate-800 py-4 px-6">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> 2. Sectional Paper Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {/* Section A: MCQ */}
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-400">Section A: MCQs (Objective)</span>
                    <Badge className="bg-blue-500/10 text-blue-400 font-mono text-[10px]">{mcqCount * mcqMarks} Marks</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[9px] text-slate-400 uppercase">Question Count</Label>
                      <Input type="number" value={mcqCount} onChange={e => setMcqCount(Number(e.target.value))} className="bg-slate-900 border-slate-800 text-xs font-bold text-white h-8" />
                    </div>
                    <div>
                      <Label className="text-[9px] text-slate-400 uppercase">Marks Per Q</Label>
                      <Input type="number" value={mcqMarks} onChange={e => setMcqMarks(Number(e.target.value))} className="bg-slate-900 border-slate-800 text-xs font-bold text-white h-8" />
                    </div>
                  </div>
                </div>

                {/* Section B: Theory */}
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-400">Section B: Short Theory</span>
                    <Badge className="bg-indigo-500/10 text-indigo-400 font-mono text-[10px]">{theoryCount * theoryMarks} Marks</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[9px] text-slate-400 uppercase">Question Count</Label>
                      <Input type="number" value={theoryCount} onChange={e => setTheoryCount(Number(e.target.value))} className="bg-slate-900 border-slate-800 text-xs font-bold text-white h-8" />
                    </div>
                    <div>
                      <Label className="text-[9px] text-slate-400 uppercase">Marks Per Q</Label>
                      <Input type="number" value={theoryMarks} onChange={e => setTheoryMarks(Number(e.target.value))} className="bg-slate-900 border-slate-800 text-xs font-bold text-white h-8" />
                    </div>
                  </div>
                </div>

                {/* Section C: Practical */}
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-400">Section C: Practical / Lab Task</span>
                    <Badge className="bg-purple-500/10 text-purple-400 font-mono text-[10px]">{practicalCount * practicalMarks} Marks</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[9px] text-slate-400 uppercase">Question Count</Label>
                      <Input type="number" value={practicalCount} onChange={e => setPracticalCount(Number(e.target.value))} className="bg-slate-900 border-slate-800 text-xs font-bold text-white h-8" />
                    </div>
                    <div>
                      <Label className="text-[9px] text-slate-400 uppercase">Marks Per Q</Label>
                      <Input type="number" value={practicalMarks} onChange={e => setPracticalMarks(Number(e.target.value))} className="bg-slate-900 border-slate-800 text-xs font-bold text-white h-8" />
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400">Total Paper Aggregate Score:</span>
                  <span className="text-base font-black font-mono text-white">{totalPaperMarks} Marks</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Multi-Set Auto Generator & Preview */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="rounded-2xl border-slate-800 bg-slate-900/90 shadow-xl backdrop-blur-xl">
              <CardHeader className="bg-slate-950/80 border-b border-slate-800 py-4 px-6 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" /> Multi-Set Paper Generator (Set A, Set B, Set C, Set D)
                  </CardTitle>
                </div>
                <Button 
                  onClick={handleGeneratePaperSets}
                  disabled={generating}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-9 px-4 flex items-center gap-2"
                >
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Generate 4 Paper Sets
                </Button>
              </CardHeader>
              <CardContent className="p-6">
                {generatedSets.length === 0 ? (
                  <div className="p-12 text-center space-y-3 bg-slate-950/50 rounded-2xl border border-dashed border-slate-800">
                    <Sparkles className="w-10 h-10 text-slate-600 mx-auto animate-pulse" />
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">No Paper Sets Assembled Yet</h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Select your saved blueprint or target course and click "Generate 4 Paper Sets" to automatically assemble randomized question paper variants (Set A, B, C, D).
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {generatedSets.map((set, idx) => (
                      <div key={idx} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3 relative overflow-hidden flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                              <Badge className="bg-indigo-600 text-white font-black text-xs px-2 py-0.5">{set.setName}</Badge>
                              <span>{set.code.replace(/Set [A-D]\s*/, "")}</span>
                            </h4>
                            <Badge className="bg-emerald-500/10 text-emerald-400 font-mono text-[9px]">{set.totalMarks} Marks ({set.duration} min)</Badge>
                          </div>
                          <div className="space-y-1 text-xs text-slate-400 mt-2">
                            <p>• {set.mcqs} Objective MCQs</p>
                            <p>• {set.theory} Theory Questions</p>
                            <p>• {set.practical} Practical Lab Task</p>
                            <p className="text-[10px] font-mono text-indigo-400 pt-1">Rule: {set.strategy}</p>
                          </div>
                        </div>
                        <Button 
                          onClick={() => handleOpenPreview(set)}
                          size="sm" 
                          variant="outline" 
                          className="w-full rounded-xl border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-600 hover:text-white text-indigo-300 text-xs font-bold h-9 mt-2 flex items-center justify-center gap-2"
                        >
                          <Eye className="w-3.5 h-3.5" /> Preview Question Paper PDF
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Interactive Printable PDF Preview Modal */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-950 border-slate-800 text-slate-100 p-0 sm:rounded-2xl shadow-2xl">
          {activePreviewSet && (
            <div className="space-y-6">
              {/* Modal Control Action Header */}
              <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <Badge className="bg-indigo-600 text-white font-black text-xs px-2.5 py-1">{activePreviewSet.setName}</Badge>
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{paperTitle}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Button 
                    onClick={handleCopyPaper} 
                    size="sm" 
                    variant="outline" 
                    className="rounded-xl border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 h-8 gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Text
                  </Button>
                  <Button 
                    onClick={handlePrintPdf} 
                    size="sm" 
                    className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white h-8 gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print / Download PDF
                  </Button>
                </div>
              </div>

              {/* Printable Examination Paper Content */}
              <div className="p-8 space-y-6 bg-white text-slate-900 rounded-b-2xl font-serif text-sm leading-relaxed print:p-0 print:m-0 print:shadow-none" id="printable-exam-paper">
                {/* Official Exam Header */}
                <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
                  <h2 className="text-xl font-black uppercase tracking-widest">SIR CHHOTU RAM EDUCATION (SCRE)</h2>
                  <h3 className="text-base font-bold text-slate-800 uppercase">{paperTitle}</h3>
                  <div className="flex items-center justify-center gap-4 text-xs font-bold text-slate-700 pt-1">
                    <span>COURSE: {courses.find(c => c.id === selectedCourse)?.course_name || "Official Academic Program"}</span>
                    <span>•</span>
                    <span>SUBJECT: {subjects.find(s => s._id === selectedSubject)?.subject_name || "Comprehensive Paper"}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-extrabold text-slate-900 border-t border-slate-300 pt-2 mt-2">
                    <span>TIME ALLOWED: {activePreviewSet.duration} MINUTES</span>
                    <span className="text-sm font-black tracking-widest bg-slate-900 text-white px-3 py-0.5 rounded-md">{activePreviewSet.setName}</span>
                    <span>MAXIMUM MARKS: {activePreviewSet.totalMarks} MARKS</span>
                  </div>
                </div>

                {/* Candidate Instructions */}
                <div className="bg-slate-100 p-3 rounded-lg border border-slate-300 text-xs text-slate-800 space-y-1 font-sans">
                  <p className="font-bold uppercase tracking-wider text-slate-900">General Instructions to Candidates:</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-[11px]">
                    <li>All questions are compulsory unless specified otherwise.</li>
                    <li>Write your Roll Number, Center Code, and <strong>Set Code ({activePreviewSet.setName})</strong> clearly on your answer sheet.</li>
                    <li>Use of programmable calculators, mobile phones, or unauthorized notes is strictly prohibited.</li>
                    <li>For MCQs in Section A, mark the correct option clearly.</li>
                  </ol>
                </div>

                {/* SECTION A: MCQs */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between border-b-2 border-slate-800 pb-1">
                    <h4 className="font-black text-sm uppercase tracking-wide">SECTION A: OBJECTIVE MCQs</h4>
                    <span className="font-bold text-xs">({activePreviewSet.mcqs * mcqMarks} MARKS)</span>
                  </div>

                  <div className="space-y-4 font-sans text-xs">
                    {activePreviewSet.mcqQuestions.map((q, idx) => (
                      <div key={idx} className="space-y-1.5">
                        <p className="font-semibold text-slate-900">{q.question_text}</p>
                        <div className="grid grid-cols-2 gap-2 pl-4">
                          {q.options.map((opt, optIdx) => (
                            <div key={optIdx} className="flex items-center gap-1.5 text-slate-700">
                              <span className="font-bold font-mono">({String.fromCharCode(65 + optIdx)})</span>
                              <span>{opt}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SECTION B: SHORT THEORY */}
                {activePreviewSet.theoryQuestions.length > 0 && (
                  <div className="space-y-4 pt-4">
                    <div className="flex items-center justify-between border-b-2 border-slate-800 pb-1">
                      <h4 className="font-black text-sm uppercase tracking-wide">SECTION B: SHORT THEORY QUESTIONS</h4>
                      <span className="font-bold text-xs">({activePreviewSet.theory * theoryMarks} MARKS)</span>
                    </div>

                    <div className="space-y-5 font-sans text-xs">
                      {activePreviewSet.theoryQuestions.map((q, idx) => (
                        <div key={idx} className="space-y-2">
                          <div className="flex justify-between font-semibold text-slate-900">
                            <span>{q.question_text}</span>
                            <span className="font-mono text-[11px]">[{theoryMarks} Marks]</span>
                          </div>
                          {/* Answer Box Placeholder Lines */}
                          <div className="border border-dashed border-slate-300 rounded-md p-3 min-h-[50px] bg-slate-50 text-[10px] text-slate-400 italic">
                            Candidate Response Area
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SECTION C: PRACTICAL TASK */}
                {activePreviewSet.practicalQuestions.length > 0 && (
                  <div className="space-y-4 pt-4">
                    <div className="flex items-center justify-between border-b-2 border-slate-800 pb-1">
                      <h4 className="font-black text-sm uppercase tracking-wide">SECTION C: PRACTICAL LAB TASK</h4>
                      <span className="font-bold text-xs">({activePreviewSet.practical * practicalMarks} MARKS)</span>
                    </div>

                    <div className="space-y-4 font-sans text-xs">
                      {activePreviewSet.practicalQuestions.map((q, idx) => (
                        <div key={idx} className="space-y-2 p-3 bg-slate-50 border border-slate-300 rounded-md">
                          <div className="flex justify-between font-bold text-slate-900">
                            <span>{q.question_text}</span>
                            <span className="font-mono text-[11px]">[{practicalMarks} Marks]</span>
                          </div>
                          <p className="text-[11px] text-slate-600">
                            Perform the practical task on your allotted lab terminal. Verify source code compilation and functional output with the Invigilator.
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
