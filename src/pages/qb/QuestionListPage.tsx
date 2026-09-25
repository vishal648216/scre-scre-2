import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Hash,
  Search,
  FileSpreadsheet,
} from "lucide-react";
import { BulkCsvUploadModal } from "@/components/BulkCsvUploadModal";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface Question {
  _id?: string;
  question_text: string;
  options: string[];
  correct_option_index: number;
  bank_id?: string;
  created_at?: string;
  isNew?: boolean;
}

interface QuestionBank {
  _id: string;
  name: string;
  question_count?: number;
  target_question_count?: number;
}

const QuestionListPage = () => {
  const { t } = useTranslation();
  const { bankId } = useParams<{ bankId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bank, setBank] = useState<QuestionBank | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [search, setSearch] = useState("");
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  const fetchBankDetails = async () => {
    try {
      const banksRes = await apiFetch("/api/qb/banks");
      const banksData = await banksRes.json();
      const foundBank = (Array.isArray(banksData) ? banksData : []).find(
        (b: any) => b._id === bankId || b.id === bankId
      );
      if (foundBank) {
        setBank(foundBank);
      }

      const qRes = await apiFetch(`/api/qb/banks/${bankId}/questions`);
      const qData = await qRes.json();

      const normalizeQuestion = (q: any): Question => {
        let opts: string[] = [];
        if (Array.isArray(q.options)) {
          opts = q.options.map((opt: any) => {
            if (typeof opt === "string") return opt;
            if (typeof opt === "object" && opt !== null) {
              return opt.text || opt.label || opt.value || opt.option || "";
            }
            return String(opt || "");
          });
        }
        while (opts.length < 4) {
          opts.push("");
        }

        let correctIdx = 0;
        if (typeof q.correct_option_index === "number") {
          correctIdx = q.correct_option_index;
        } else if (typeof q.correct_option === "string") {
          const norm = q.correct_option.trim().toLowerCase();
          if (norm === "a" || norm === "1" || norm === "option a" || norm === "option_a") correctIdx = 0;
          else if (norm === "b" || norm === "2" || norm === "option b" || norm === "option_b") correctIdx = 1;
          else if (norm === "c" || norm === "3" || norm === "option c" || norm === "option_c") correctIdx = 2;
          else if (norm === "d" || norm === "4" || norm === "option d" || norm === "option_d") correctIdx = 3;
        }

        return {
          _id: q._id || q.id,
          question_text: q.question_text || q.question || "",
          options: opts,
          correct_option_index: correctIdx,
          bank_id: q.bank_id,
          created_at: q.created_at,
          isNew: false,
        };
      };

      let allQuestions = (Array.isArray(qData) ? qData : []).map(normalizeQuestion);

      if (allQuestions.length === 0) {
        allQuestions = [{
          question_text: "",
          options: ["", "", "", ""],
          correct_option_index: 0,
          isNew: true,
        }];
      }

      setQuestions(allQuestions);
    } catch (error) {
      toast.error(t("Failed to load bank"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (bankId) fetchBankDetails();
  }, [bankId]);

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        question_text: "",
        options: ["", "", "", ""],
        correct_option_index: 0,
        isNew: true,
      },
    ]);
  };

  const deleteQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, updated: Partial<Question>) => {
    const newQuestions = [...questions];
    newQuestions[index] = { ...newQuestions[index], ...updated };
    setQuestions(newQuestions);
  };

  const addOption = (index: number) => {
    const newQuestions = [...questions];
    newQuestions[index].options.push("");
    setQuestions(newQuestions);
  };

  const removeOption = (qIndex: number, oIndex: number) => {
    if (questions[qIndex].options.length <= 2) {
      toast.error(t("At least 2 options are required"));
      return;
    }
    const newQuestions = [...questions];
    newQuestions[qIndex].options.splice(oIndex, 1);
    if (newQuestions[qIndex].correct_option_index === oIndex) {
      newQuestions[qIndex].correct_option_index = 0;
    } else if (newQuestions[qIndex].correct_option_index > oIndex) {
      newQuestions[qIndex].correct_option_index -= 1;
    }
    setQuestions(newQuestions);
  };

  const updateOption = (qIndex: number, oIndex: number, text: string) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].options[oIndex] = text;
    setQuestions(newQuestions);
  };

  const saveAllQuestions = async () => {
    setSaving(true);
    try {
      let allSaved = true;
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.question_text.trim()) continue;

        const correctKey = String.fromCharCode(97 + (q.correct_option_index || 0));
        const formattedOptions = q.options.map((text, idx) => ({
          key: String.fromCharCode(97 + idx),
          text,
        }));

        const payload = {
          bank_id: bankId,
          question_text: q.question_text,
          options: q.options,
          formatted_options: formattedOptions,
          correct_option: correctKey,
          correct_option_index: q.correct_option_index,
        };
        let res;
        if (q._id && !q.isNew) {
          res = await apiFetch(`/api/qb/questions/${q._id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
        } else {
          res = await apiFetch("/api/qb/questions", {
            method: "POST",
            body: JSON.stringify(payload),
          });
        }
        if (!res.ok) allSaved = false;
      }
      if (allSaved) {
        toast.success(t("All questions saved successfully"));
        fetchBankDetails();
      } else {
        toast.error(t("Some questions failed to save"));
      }
    } catch (error) {
      toast.error(t("Failed to save questions"));
    } finally {
      setSaving(false);
    }
  };

  const filteredQuestions = questions.filter((q) =>
    q.question_text.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
            Loading Question Bank...
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Row 1: Back, Name, Count */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/dashboard/academics/question-bank")}
              className="rounded-none h-12 w-12 border-border hover:bg-muted/50"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="space-y-1">
              <h1 className="text-3xl font-black uppercase tracking-tight text-foreground flex items-center gap-3">
                <HelpCircle className="w-7 h-7 text-primary" />
                {bank?.name}
              </h1>
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  {t("Target Questions")}:{" "}
                  <span className="text-primary font-black">
                    {bank?.target_question_count ?? "Not set"}
                  </span>
                </span>
                <span className="text-[10px] font-black text-primary border border-primary/30 bg-primary/5 px-3 py-1">
                  {bank?.question_count ?? 0} {t("Saved Questions")}
                </span>
                <span className="text-[10px] font-black text-emerald-600 border border-emerald-600/30 bg-emerald-50 px-3 py-1">
                  {questions.length} {t("Total Questions")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Search, Add, Save */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t("Search questions...")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 rounded-none border-border font-bold uppercase text-xs focus-visible:ring-0 focus-visible:border-primary h-12"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setIsBulkModalOpen(true)}
              variant="outline"
              className="rounded-none border-2 border-primary text-primary hover:bg-primary/10 font-black uppercase tracking-widest text-[10px] px-6 h-12 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {t("Bulk Upload CSV")}
            </Button>
            <Button
              onClick={addQuestion}
              className="rounded-none bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-[10px] px-6 h-12 border-2 border-primary shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t("Add Question")}
            </Button>
            <Button
              onClick={saveAllQuestions}
              disabled={saving}
              className="rounded-none bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[10px] px-8 h-12 border-2 border-emerald-700 shadow-[4px_4px_0px_0px_rgba(5,150,105,0.5)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {t("Save All")}
            </Button>
          </div>
        </div>

        <BulkCsvUploadModal
          isOpen={isBulkModalOpen}
          onClose={() => setIsBulkModalOpen(false)}
          title="Bulk Upload Questions"
          description="Upload multiple multiple-choice questions directly to this question bank using a pre-formatted CSV file."
          uploadEndpoint="/api/qb/questions/bulk"
          sampleFilename="questions_bulk_template.csv"
          onSuccess={fetchBankDetails}
          transformRows={(rows) =>
            rows.map((r) => ({
              ...r,
              bank_id: r.bank_id && r.bank_id.trim() ? r.bank_id.trim() : bankId || "",
            }))
          }
          columns={[
            { key: "question_text", label: "Question Text", required: true },
            { key: "option_a", label: "Option A", required: true },
            { key: "option_b", label: "Option B", required: true },
            { key: "option_c", label: "Option C", required: true },
            { key: "option_d", label: "Option D", required: true },
            { key: "correct_option", label: "Correct Option (a/b/c/d)", required: true },
            { key: "difficulty", label: "Difficulty (easy/medium/hard)" },
            { key: "marks", label: "Marks" },
            { key: "explanation", label: "Explanation" },
            { key: "bank_id", label: "Bank ID" },
          ]}
          sampleData={[
            {
              bank_id: bankId || "",
              question_text: "What is the capital of India?",
              option_a: "Mumbai",
              option_b: "New Delhi",
              option_c: "Kolkata",
              option_d: "Chennai",
              correct_option: "b",
              difficulty: "easy",
              marks: "1",
              explanation: "New Delhi is the official capital of India.",
            },
            {
              bank_id: bankId || "",
              question_text: "Which programming language is used for web frontend?",
              option_a: "JavaScript",
              option_b: "C++",
              option_c: "Assembly",
              option_d: "COBOL",
              correct_option: "a",
              difficulty: "medium",
              marks: "1",
              explanation: "JavaScript is the primary standard programming language for modern web browsers.",
            },
          ]}
        />

        {/* Question Cards */}
        <div className="grid grid-cols-1 gap-6">
          {filteredQuestions.map((question, index) => (
            <Card
              key={`question-${index}-${question._id || "new"}`}
              className="rounded-none border-2 border-border bg-card hover:border-primary transition-colors group"
            >
              <CardHeader className="p-6 border-b-2 border-border group-hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3 mb-2">
                      {/* Serial Number */}
                      <div className="w-10 h-10 flex items-center justify-center bg-primary text-primary-foreground text-[10px] font-black border-2 border-primary">
                        {index + 1}
                      </div>
                      <span className="px-2 py-0.5 bg-muted border border-border text-muted-foreground text-[10px] font-black uppercase tracking-widest">
                        {question.options.length} {t("Options")}
                      </span>
                    </div>

                    <Textarea
                      value={question.question_text}
                      onChange={(e) =>
                        updateQuestion(index, {
                          question_text: e.target.value,
                        })
                      }
                      placeholder={t("Enter your question here...")}
                      className="rounded-none min-h-[100px] border-border bg-background text-sm font-medium focus:border-primary transition-all resize-none"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteQuestion(index)}
                    className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-none"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {t("Answer Options")}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addOption(index)}
                    className="rounded-none h-8 text-[10px] font-black uppercase tracking-widest border-primary/20 text-primary hover:bg-primary/5"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    {t("Add Option")}
                  </Button>
                </div>
                <div className="space-y-3 pt-2">
                  {question.options.map((opt, oIndex) => (
                    <div
                      key={oIndex}
                      className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-300"
                    >
                      <div
                        className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-none border-2 transition-all cursor-pointer ${question.correct_option_index === oIndex
                          ? "bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-200"
                          : "bg-muted border-border text-muted-foreground"
                          }`}
                        onClick={() =>
                          updateQuestion(index, {
                            correct_option_index: oIndex,
                          })
                        }
                      >
                        <span className="text-sm font-black">
                          {String.fromCharCode(65 + oIndex)}
                        </span>
                      </div>
                      <div className="flex-1 relative">
                        <Input
                          required
                          value={opt}
                          onChange={(e) =>
                            updateOption(index, oIndex, e.target.value)
                          }
                          placeholder={`${t("Option")} ${String.fromCharCode(
                            65 + oIndex
                          )}...`}
                          className={`h-10 rounded-none border-border bg-background text-sm font-medium focus:border-primary transition-all pr-10 ${question.correct_option_index === oIndex
                            ? "ring-1 ring-emerald-500/30 border-emerald-500/50"
                            : ""
                            }`}
                        />
                        {question.correct_option_index === oIndex && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          </div>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOption(index, oIndex)}
                        disabled={question.options.length <= 2}
                        className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-none"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <BulkCsvUploadModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        title="Bulk Upload Questions"
        description="Upload multiple multiple-choice questions directly to this question bank using a pre-formatted CSV file."
        uploadEndpoint="/api/qb/questions/bulk"
        sampleFilename="question_bank_template.csv"
        onSuccess={() => {
          fetchBankDetails();
        }}
        columns={[
          { key: "question_text", label: "Question Text", required: true },
          { key: "option_a", label: "Option A", required: true },
          { key: "option_b", label: "Option B", required: true },
          { key: "option_c", label: "Option C" },
          { key: "option_d", label: "Option D" },
          { key: "correct_option", label: "Correct Option (a/b/c/d)", required: true },
          { key: "difficulty", label: "Difficulty (easy/medium/hard)" },
          { key: "marks", label: "Marks" },
          { key: "explanation", label: "Explanation" },
          { key: "bank_id", label: "Bank ID" },
        ]}
        sampleData={[
          {
            question_text: "What is the shortcut key to copy text in Windows?",
            option_a: "Ctrl + C",
            option_b: "Ctrl + V",
            option_c: "Ctrl + X",
            option_d: "Ctrl + Z",
            correct_option: "a",
            difficulty: "easy",
            marks: "1",
            explanation: "Ctrl+C is used to copy selected text or items.",
            bank_id: bankId || "",
          },
        ]}
        transformRows={(rows) =>
          rows.map((r) => ({
            ...r,
            bank_id: r.bank_id || bankId || "",
          }))
        }
      />
    </DashboardLayout>
  );
};

export default QuestionListPage;
