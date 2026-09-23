import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  Trash2,
  CheckCircle2,
  HelpCircle,
  Search,
  Check,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Question {
  _id?: string;
  question_text: string;
  question_type?: "MCQ" | "TRUE_FALSE" | "FILL_BLANKS" | "THEORY";
  options: string[];
  correct_option_index: number;
  fill_blank_answer?: string;
  theory_answer?: string;
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

  const fetchBankDetails = async () => {
    try {
      const banksRes = await apiFetch("/api/qb/banks");
      const banksData = await banksRes.json();
      const foundBank = banksData.find(
        (b: any) => b._id === bankId || b._id === bankId
      );
      if (foundBank) {
        setBank(foundBank);
      }

      const qRes = await apiFetch(`/api/qb/banks/${bankId}/questions`);
      const qData = await qRes.json();
      let allQuestions = qData.map((q: any) => ({
        ...q,
        options: q.options || [],
        question_type: q.question_type || (q.options && q.options.length > 0 ? "MCQ" : "THEORY"),
        isNew: false,
      }));

      if (foundBank?.target_question_count && foundBank.target_question_count > allQuestions.length) {
        const numToAdd = foundBank.target_question_count - allQuestions.length;
        const newQs = Array.from({ length: numToAdd }, () => ({
          question_text: "",
          question_type: "MCQ" as const,
          options: ["", "", "", ""],
          correct_option_index: 0,
          isNew: true,
        }));
        allQuestions = [...allQuestions, ...newQs];
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
        question_type: "MCQ",
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
    if (!newQuestions[index].options) newQuestions[index].options = [];
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

        const payload = {
          bank_id: bankId,
          question_text: q.question_text,
          question_type: q.question_type || "MCQ",
          options: q.options || [],
          correct_option_index: q.correct_option_index || 0,
          fill_blank_answer: q.fill_blank_answer || "",
          theory_answer: q.theory_answer || ""
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
              onClick={() => navigate(`/dashboard/academics/question-bank/${bankId}/questions/new`)}
              variant="outline"
              className="rounded-none border-primary/40 text-primary font-black uppercase tracking-widest text-[10px] px-6 h-12 hover:bg-primary/10 transition-all"
            >
              <Plus className="w-4 h-4 mr-2" />
              Detailed Form Add
            </Button>
            <Button
              onClick={addQuestion}
              className="rounded-none bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-[10px] px-6 h-12 border-2 border-primary shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t("Quick Add")}
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

        {/* Question Cards */}
        <div className="grid grid-cols-1 gap-6">
          {filteredQuestions.map((question, index) => {
            const qType = question.question_type || "MCQ";
            return (
              <Card
                key={`question-${index}-${question._id || "new"}`}
                className="rounded-none border-2 border-border bg-card hover:border-primary transition-colors group"
              >
                <CardHeader className="p-6 border-b-2 border-border group-hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        {/* Serial Number */}
                        <div className="w-10 h-10 flex items-center justify-center bg-primary text-primary-foreground text-[10px] font-black border-2 border-primary">
                          {index + 1}
                        </div>

                        {/* Inline Type Selector */}
                        <Select
                          value={qType}
                          onValueChange={(val: "MCQ" | "TRUE_FALSE" | "FILL_BLANKS" | "THEORY") => {
                            updateQuestion(index, {
                              question_type: val,
                              options: val === "MCQ" ? (question.options?.length ? question.options : ["", "", "", ""]) : val === "TRUE_FALSE" ? ["True", "False"] : [],
                              correct_option_index: 0,
                            });
                          }}
                        >
                          <SelectTrigger className="w-[170px] h-10 rounded-none border-2 border-primary/40 bg-background text-primary font-black uppercase text-[10px] tracking-widest">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-none border-2 border-border font-bold uppercase text-xs">
                            <SelectItem value="MCQ">Multiple Choice (MCQ)</SelectItem>
                            <SelectItem value="TRUE_FALSE">True / False</SelectItem>
                            <SelectItem value="FILL_BLANKS">Fill in Blanks</SelectItem>
                            <SelectItem value="THEORY">Theory / Long Answer</SelectItem>
                          </SelectContent>
                        </Select>

                        {qType === "MCQ" && (
                          <span className="px-2.5 py-1 bg-muted border border-border text-muted-foreground text-[10px] font-black uppercase tracking-widest">
                            {question.options?.length || 0} {t("Options")}
                          </span>
                        )}
                      </div>

                      <Textarea
                        value={question.question_text}
                        onChange={(e) =>
                          updateQuestion(index, {
                            question_text: e.target.value,
                          })
                        }
                        placeholder={t("Enter your question statement here...")}
                        className="rounded-none min-h-[90px] border-border bg-background text-sm font-medium focus:border-primary transition-all resize-none"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      {question._id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/dashboard/academics/question-bank/${bankId}/questions/${question._id}`)}
                          className="h-10 w-10 text-primary hover:bg-primary/10 rounded-none"
                          title="Full Edit Form"
                        >
                          <HelpCircle className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteQuestion(index)}
                        className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-none"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-6 space-y-4">
                  {/* MCQ UI */}
                  {qType === "MCQ" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            {t("Answer Options (Click option letter to select correct answer)")}
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
                      <div className="space-y-3 pt-1">
                        {question.options.map((opt, oIndex) => (
                          <div
                            key={oIndex}
                            className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-300"
                          >
                            <div
                              className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-none border-2 transition-all cursor-pointer ${
                                question.correct_option_index === oIndex
                                  ? "bg-emerald-600 border-emerald-600 text-white shadow-md"
                                  : "bg-muted border-border text-muted-foreground hover:border-primary"
                              }`}
                              onClick={() =>
                                updateQuestion(index, {
                                  correct_option_index: oIndex,
                                })
                              }
                              title="Click to set as correct answer"
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
                                className={`h-10 rounded-none border-border bg-background text-sm font-medium focus:border-primary transition-all pr-10 ${
                                  question.correct_option_index === oIndex
                                    ? "ring-1 ring-emerald-500/30 border-emerald-500/50"
                                    : ""
                                }`}
                              />
                              {question.correct_option_index === oIndex && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-emerald-600 font-bold text-[10px]">
                                  <CheckCircle2 className="w-4 h-4" />
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
                    </div>
                  )}

                  {/* TRUE / FALSE UI */}
                  {qType === "TRUE_FALSE" && (
                    <div className="space-y-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                        Select Correct Answer:
                      </span>
                      <div className="grid grid-cols-2 gap-4 max-w-md">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => updateQuestion(index, { correct_option_index: 0, options: ["True", "False"] })}
                          className={`rounded-none h-12 font-black uppercase tracking-widest border-2 transition-all flex items-center justify-center gap-2 ${
                            question.correct_option_index === 0
                              ? "bg-emerald-600 text-white border-emerald-700 shadow-md"
                              : "border-border text-foreground hover:border-emerald-600"
                          }`}
                        >
                          <Check className="w-5 h-5" />
                          TRUE (CORRECT)
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => updateQuestion(index, { correct_option_index: 1, options: ["True", "False"] })}
                          className={`rounded-none h-12 font-black uppercase tracking-widest border-2 transition-all flex items-center justify-center gap-2 ${
                            question.correct_option_index === 1
                              ? "bg-rose-600 text-white border-rose-700 shadow-md"
                              : "border-border text-foreground hover:border-rose-600"
                          }`}
                        >
                          <X className="w-5 h-5" />
                          FALSE (CORRECT)
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* FILL IN BLANKS UI */}
                  {qType === "FILL_BLANKS" && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                        Correct Answer Phrase / Word:
                      </span>
                      <Input
                        value={question.fill_blank_answer || ""}
                        onChange={(e) => updateQuestion(index, { fill_blank_answer: e.target.value })}
                        placeholder="e.g., Central Processing Unit"
                        className="h-10 rounded-none border-2 border-primary/30 font-medium text-sm focus-visible:border-primary"
                      />
                    </div>
                  )}

                  {/* THEORY UI */}
                  {qType === "THEORY" && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                        Model Answer / Rubric / Grading Key (Optional):
                      </span>
                      <Textarea
                        value={question.theory_answer || ""}
                        onChange={(e) => updateQuestion(index, { theory_answer: e.target.value })}
                        placeholder="Enter reference answer or evaluation criteria..."
                        className="rounded-none min-h-[80px] border-2 border-primary/30 font-medium text-sm focus-visible:border-primary resize-none"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default QuestionListPage;
