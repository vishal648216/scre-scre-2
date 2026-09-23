import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Printer, FileText } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface Question {
  _id: string;
  question_text: string;
  options?: string[];
  question_type: string;
  marks: number;
  image_url?: string;
}

const PrintQuestionPaper = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiFetch(`/api/exam/papers/${id}`);
        if (res.ok) setData(await res.json());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  if (!data) return <div className="p-8 text-center">Paper not found</div>;

  const { paper, blueprint, questions } = data;

  if (!paper || !blueprint) return <div className="p-8 text-center">Invalid paper or blueprint data</div>;

  return (
    <div className="min-h-screen bg-white p-12 max-w-4xl mx-auto print:p-0">
      <div className="no-print mb-8 flex justify-between items-center bg-muted/30 p-4 border border-border">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Print Preview Mode</p>
        <Button onClick={() => window.print()} className="rounded-none font-black uppercase tracking-widest text-xs px-8">
          <Printer className="w-4 h-4 mr-2" /> Print Paper
        </Button>
      </div>

      <div className="space-y-8 border-2 border-black p-10">
        {/* Header */}
        <div className="text-center space-y-2 border-b-2 border-black pb-6">
          <h1 className="text-2xl font-black uppercase tracking-tighter">EXAMINATION QUESTION PAPER</h1>
          <h2 className="text-xl font-bold uppercase">{blueprint.name}</h2>
          <div className="flex justify-center gap-8 text-[10px] font-black uppercase tracking-widest pt-2">
            <span>Time: {blueprint.duration_minutes} Mins</span>
            <span>Max Marks: {blueprint.total_marks}</span>
          </div>
        </div>

        {/* Student Info Placeholder */}
        <div className="grid grid-cols-2 gap-4 text-[10px] font-bold uppercase border-b-2 border-black pb-6">
          <div className="space-y-2">
            <p>Student Name: ___________________________</p>
            <p>Roll Number: ____________________________</p>
          </div>
          <div className="space-y-2 text-right">
            <p>Date: {new Date().toLocaleDateString()}</p>
            <p>Center Code: ____________________________</p>
          </div>
        </div>

        {/* Instructions */}
        <div className="space-y-2 italic text-xs border-b-2 border-black pb-6">
          <p className="font-black uppercase not-italic">General Instructions:</p>
          <p>1. All questions are compulsory unless stated otherwise.</p>
          <p>2. Marks for each question are indicated on the right side.</p>
          {blueprint.instructions && <p>3. {blueprint.instructions}</p>}
        </div>

        {/* Questions */}
        <div className="space-y-10">
          {questions.map((q: Question, idx: number) => (
            <div key={q._id} className="space-y-4 break-inside-avoid">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 space-y-4">
                  <div className="font-bold text-sm flex gap-2">
                    <span>Q{idx + 1}.</span>
                    <span className="leading-relaxed">{q.question_text}</span>
                  </div>
                  
                  {q.image_url && (
                    <img src={q.image_url} alt="" className="max-h-48 object-contain border border-black p-1" />
                  )}

                  {q.question_type === "MCQ" && q.options && (
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 pl-8">
                      {q.options.map((opt, i) => (
                        <div key={i} className="text-xs flex gap-2">
                          <span className="font-black">({String.fromCharCode(65 + i)})</span>
                          <span>{opt}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {(q.question_type === "Theory" || q.question_type === "Practical") && (
                    <div className="pl-8 h-24 border-b border-dotted border-gray-400">
                      <p className="text-[8px] uppercase text-gray-400 pt-2">(Write your response below)</p>
                    </div>
                  )}
                </div>
                <div className="font-black text-xs shrink-0">[{q.marks}]</div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-12 text-center text-[10px] font-black uppercase tracking-widest border-t-2 border-black mt-20">
          --- End of Question Paper ---
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print { display: none !important; }
          body { padding: 0 !important; background: white !important; }
          .min-h-screen { min-height: auto !important; }
        }
      `}} />
    </div>
  );
};

export default PrintQuestionPaper;
