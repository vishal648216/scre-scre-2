import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Clock,
  GraduationCap,
  CheckCircle2,
  Layers,
  Award,
  Download,
  Calendar,
  Sparkles,
} from "lucide-react";

interface SyllabusCoverageModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: {
    course_name?: string;
    title?: string;
    course_code?: string;
    duration_months?: number;
    duration_value?: number;
    duration_unit?: string;
    eligibility?: string;
    syllabus?: string;
    description?: string;
  } | null;
}

export const SyllabusCoverageModal: React.FC<SyllabusCoverageModalProps> = ({
  isOpen,
  onClose,
  course,
}) => {
  if (!course) return null;

  const courseTitle = course.course_name || course.title || "Course Curriculum";
  const durationText = course.duration_value
    ? `${course.duration_value} ${course.duration_unit || "Months"}`
    : `${course.duration_months || 6} Months`;

  // Default breakdown modules if syllabus string is simple or unparsed
  const parsedModules = React.useMemo(() => {
    if (course.syllabus && course.syllabus.includes("#")) {
      const parts = course.syllabus.split(/(?=#+ )/g);
      return parts.map((part, index) => {
        const lines = part.trim().split("\n");
        const title = lines[0].replace(/^#+\s*/, "");
        const content = lines.slice(1).join("\n").trim();
        return {
          moduleNumber: index + 1,
          title: title || `Module ${index + 1}`,
          topics: content.split("\n").filter((l) => l.trim().length > 0),
          hours: 20 + index * 5,
        };
      });
    }

    return [
      {
        moduleNumber: 1,
        title: "Fundamentals & Architecture",
        topics: [
          "Introduction to Core Concepts & Industry Standards",
          "System Environment, Tooling & Workflows",
          "Theoretical Foundations & Problem Analysis",
          "Diagnostic Lab & Orientation Exercise",
        ],
        hours: 24,
      },
      {
        moduleNumber: 2,
        title: "Intermediate Practical Operations",
        topics: [
          "Hands-on Implementation of Key Modules",
          "Data Handling, Optimization & Execution",
          "Real-world Business Case Studies",
          "Mid-Term Practical Evaluation & Review",
        ],
        hours: 32,
      },
      {
        moduleNumber: 3,
        title: "Advanced Specialization & Projects",
        topics: [
          "Complex Problem Solving & Domain Workflows",
          "Industry Best Practices & Quality Benchmarks",
          "Security, Troubleshooting & Maintenance",
          "Capstone Project Development & Mentorship",
        ],
        hours: 40,
      },
      {
        moduleNumber: 4,
        title: "Professional Skills & Certification Prep",
        topics: [
          "Viva Voce, Interview Preparation & Portfolio Building",
          "Mock Computer-Based Testing (CBT) Drills",
          "Internship / Apprenticeship Readiness",
          "Final Assessment & Certification Allotment",
        ],
        hours: 16,
      },
    ];
  }, [course]);

  const totalHours = parsedModules.reduce((acc, m) => acc + m.hours, 0);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-none border-border bg-card p-0">
        {/* Modal Header */}
        <div className="bg-primary/5 border-b border-border p-6 relative">
          <div className="flex items-center gap-2 mb-2">
            <Badge className="bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest rounded-none">
              Verified Curriculum
            </Badge>
            <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest rounded-none border-border">
              100% Industry Aligned
            </Badge>
          </div>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight text-foreground">
            {courseTitle}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Detailed modular syllabus coverage, practical laboratory breakdown & learning outcomes.
          </DialogDescription>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-border/60">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 text-primary">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[9px] uppercase font-black tracking-widest text-muted-foreground">Duration</p>
                <p className="text-xs font-bold">{durationText}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 text-primary">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[9px] uppercase font-black tracking-widest text-muted-foreground">Modules</p>
                <p className="text-xs font-bold">{parsedModules.length} Modules</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 text-primary">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[9px] uppercase font-black tracking-widest text-muted-foreground">Total Hours</p>
                <p className="text-xs font-bold">{totalHours} Hours</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 text-primary">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[9px] uppercase font-black tracking-widest text-muted-foreground">Eligibility</p>
                <p className="text-xs font-bold truncate max-w-[120px]">{course.eligibility || "10th / 12th Pass"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Modules Breakdown */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Syllabus Coverage Breakdown
            </h4>
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
              Comprehensive Course Track
            </span>
          </div>

          <div className="space-y-3">
            {parsedModules.map((module) => (
              <div
                key={module.moduleNumber}
                className="border border-border p-4 bg-background hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black">
                      {module.moduleNumber}
                    </span>
                    <span className="text-sm font-bold uppercase tracking-tight text-foreground">
                      {module.title}
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-[9px] font-black rounded-none">
                    {module.hours} Hrs Practical
                  </Badge>
                </div>

                <ul className="space-y-1.5 mt-3 pl-8 text-xs text-muted-foreground">
                  {module.topics.map((topic, tIdx) => (
                    <li key={tIdx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{topic.replace(/^[-*•]\s*/, "")}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Guarantee & Outcomes Banner */}
          <div className="p-4 bg-primary/5 border border-primary/20 flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
            <div className="flex items-center gap-3">
              <Award className="w-8 h-8 text-primary shrink-0" />
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-foreground">
                  Govt & Industry Recognized Certification
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Successfully passing the examination guarantees an authorized certificate with QR verification.
                </p>
              </div>
            </div>
            <Button
              onClick={onClose}
              className="rounded-none text-xs font-black uppercase tracking-widest px-6 shrink-0"
            >
              Continue Admission
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
