import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import {
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle
} from "lucide-react";
import { apiFetch, parseJsonArrayResponse } from "@/lib/api";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface QuestionFormData {
  bank_id: string;
  question_text: string;
  options: string[];
  correct_option_index: number;
}

const QuestionFormPage = () => {
  const { t } = useTranslation();
  const { bankId, questionId: id } = useParams<{ bankId: string; questionId?: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);

  useEffect(() => {
    if (isEdit && id) {
      fetchQuestion();
    }
  }, [isEdit, id]);

  const fetchQuestion = async () => {
    try {
      const res = await apiFetch(`/api/qb/questions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setQuestionText(data.question_text);
        if (data.options) {
          setOptions(data.options);
          setCorrectIndex(data.correct_option_index || 0);
        } else if (data.options_pool) {
          // Convert V2 format to UI-friendly V1 format for editing
          setOptions(data.options_pool.map((o: any) => o.text));
          const idx = data.options_pool.findIndex((o: any) => o.id === data.correct_option_id);
          setCorrectIndex(idx >= 0 ? idx : 0);
        }
      } else {
        toast.error(t("Failed to load question"));
        navigate(`/dashboard/academics/question-bank/${bankId}`);
      }
    } catch (error) {
      toast.error(t("An error occurred"));
    } finally {
      setLoading(false);
    }
  };

  const handleAddOption = () => {
    setOptions([...options, ""]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) {
      toast.error(t("At least 2 options are required"));
      return;
    }
    const newOptions = options.filter((_, i) => i !== index);
    setOptions(newOptions);
    if (correctIndex === index) {
      setCorrectIndex(0);
    } else if (correctIndex > index) {
      setCorrectIndex(correctIndex - 1);
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const validate = () => {
    if (!questionText.trim()) {
      toast.error(t("Question text is required"));
      return false;
    }
    if (options.some(opt => !opt.trim())) {
      toast.error(t("All options must have text"));
      return false;
    }
    if (options.length < 2) {
      toast.error(t("At least 2 options are required"));
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    const payload: any = {
      bank_id: bankId!,
      question_text: questionText,
      options,
      correct_option_index: correctIndex,
    };

    // Ensure bank_id is a clean string, never an object
    if (typeof payload.bank_id === 'object' && (payload.bank_id as any).$oid) {
      payload.bank_id = (payload.bank_id as any).$oid;
    }

    console.log("Saving question payload:", payload);

    try {
      const url = isEdit ? `/api/qb/questions/${id}` : "/api/qb/questions";
      const method = isEdit ? "PUT" : "POST";
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(t(isEdit ? "Question updated successfully" : "Question created successfully"));
        navigate(`/dashboard/academics/question-bank/${bankId}`);
      } else {
        const err = await res.json();
        toast.error(t(err.message || "Failed to save question"));
      }
    } catch (error) {
      toast.error(t("An error occurred"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
            Loading Question Details...
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-8 max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(`/dashboard/academics/question-bank/${bankId}`)}
            className="rounded-full h-10 w-10 border-primary/20 text-primary hover:bg-primary/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-foreground">
              {isEdit ? t("Edit Question") : t("Add New Question")}
            </h1>
            <p className="text-xs text-muted-foreground uppercase font-black tracking-widest mt-1">
              {isEdit ? t("MODIFY EXISTING QUESTION DETAILS") : t("CREATE A NEW MULTIPLE CHOICE QUESTION")}
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <Card className="rounded-none border-border shadow-xl overflow-hidden bg-background">
            <CardHeader className="bg-muted/30 border-b border-border py-4">
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-primary" />
                {t("Question Content")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest ml-1">{t("Question Text *")}</Label>
                <Textarea
                  required
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder={t("Enter your question here...")}
                  className="rounded-none min-h-[120px] border-border bg-background text-sm font-medium focus:border-primary transition-all resize-none"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border shadow-xl overflow-hidden bg-background">
            <CardHeader className="bg-muted/30 border-b border-border py-4 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                {t("Answer Options")}
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddOption}
                className="rounded-none h-8 text-[10px] font-black uppercase tracking-widest border-primary/20 text-primary hover:bg-primary/5 transition-all"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                {t("Add Option")}
              </Button>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="p-3 bg-blue-50/50 border border-blue-100 flex items-start gap-3 mb-4">
                <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5" />
                <p className="text-[10px] font-medium text-blue-700 uppercase tracking-wide">
                  {t("SELECT THE RADIO BUTTON NEXT TO THE CORRECT OPTION.")}
                </p>
              </div>

              <div className="space-y-3">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                    <div
                      className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border-2 transition-all cursor-pointer ${correctIndex === idx
                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-200'
                        : 'bg-muted border-transparent text-muted-foreground'
                        }`}
                      onClick={() => setCorrectIndex(idx)}
                    >
                      <span className="text-sm font-black">{String.fromCharCode(65 + idx)}</span>
                    </div>
                    <div className="flex-1 relative">
                      <Input
                        required
                        value={opt}
                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                        placeholder={`${t("Option")} ${String.fromCharCode(65 + idx)}...`}
                        className={`h-10 rounded-none border-border bg-background text-sm font-medium focus:border-primary transition-all pr-10 ${correctIndex === idx ? 'ring-1 ring-emerald-500/30 border-emerald-500/50' : ''
                          }`}
                      />
                      {correctIndex === idx && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveOption(idx)}
                      disabled={options.length <= 2}
                      className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-none"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="bg-muted/10 border-t border-border p-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/dashboard/academics/question-bank/${bankId}`)}
                className="rounded-none h-11 px-8 text-xs font-black uppercase tracking-widest border-border hover:bg-muted transition-all"
              >
                {t("Cancel")}
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="rounded-none h-11 px-10 text-xs font-black uppercase tracking-widest bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isEdit ? t("Update Question") : t("Save Question")}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </div>
    </DashboardLayout>
  );
};

// Helper components that were used but not imported
const FileText = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>
);

export default QuestionFormPage;
