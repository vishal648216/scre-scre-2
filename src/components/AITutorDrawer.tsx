import React, { useState } from 'react';
import { 
  Bot, 
  X, 
  Send, 
  Sparkles, 
  BookOpen, 
  Lightbulb, 
  Copy, 
  Check, 
  HelpCircle,
  Code2,
  Volume2
} from 'lucide-react';
import { apiUrl } from '@/lib/api';

interface TutorResponse {
  success: boolean;
  answer: string;
  subject: string;
  related_topics: string[];
  exam_tip: string;
  sample_code_or_formula?: string;
}

const QUICK_TOPICS = [
  { label: 'Primary vs Unique Key', query: 'What is the difference between primary key and unique key in DBMS?' },
  { label: 'VLOOKUP Formula', query: 'How does VLOOKUP work in Excel? Explain with syntax and example.' },
  { label: 'Tally Vouchers (F4-F9)', query: 'Explain the standard voucher types and shortcut keys in Tally Prime.' },
  { label: 'OOPs 4 Pillars', query: 'Explain the 4 pillars of Object Oriented Programming with examples.' },
  { label: 'Python List vs Tuple', query: 'What is the difference between list and tuple in Python?' },
];

const SUBJECTS = [
  'ADCA / DCA Fundamentals',
  'Tally Prime & Accounting',
  'MS Excel & Office Tools',
  'Python Programming',
  'C / C++ Programming',
  'Web Development (HTML/CSS/JS)',
  'Database Systems (DBMS/SQL)'
];

export const AITutorDrawer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState(SUBJECTS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState<Array<{ sender: 'user' | 'bot'; text: string; data?: TutorResponse }>>([
    {
      sender: 'bot',
      text: "Namaste! I am your SCRE AI Academic Tutor. Ask me any doubt related to your computer courses, formulas, accounting vouchers, programming, or exam preparation!"
    }
  ]);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleAsk = async (userQuery?: string) => {
    const question = (userQuery || query).trim();
    if (!question || isLoading) return;

    // Add user message
    setConversation(prev => [...prev, { sender: 'user', text: question }]);
    if (!userQuery) setQuery('');
    setIsLoading(true);

    try {
      const res = await fetch(apiUrl('/api/ai/doubt-solver'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: question,
          subject: selectedSubject
        })
      });

      if (!res.ok) {
        throw new Error('Failed to fetch tutor response');
      }

      const data: TutorResponse = await res.json();
      setConversation(prev => [
        ...prev,
        {
          sender: 'bot',
          text: data.answer,
          data
        }
      ]);
    } catch (err) {
      console.error(err);
      setConversation(prev => [
        ...prev,
        {
          sender: 'bot',
          text: "I encountered a momentary connection issue. Please verify your internet or try rephrasing your question!"
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleReadAloud = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      // Clean markdown characters for cleaner speech
      const clean = text.replace(/[#*`_>]/g, ' ');
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-5 z-40 group flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white rounded-full shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-105 active:scale-95 transition-all duration-200 border border-white/20"
        title="Open SCRE AI Study Assistant"
      >
        <div className="relative">
          <Bot className="w-5 h-5 text-white animate-pulse" />
          <span className="absolute -top-1 -right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
          </span>
        </div>
        <span className="text-xs font-bold tracking-wide hidden sm:inline-block">
          SCRE AI Tutor
        </span>
      </button>

      {/* Slide-over Drawer Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer Container */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[480px] bg-slate-950 text-slate-100 shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out border-l border-slate-800 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-indigo-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                  SCRE AI Academic Tutor
                </h3>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Online
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                24x7 Exam Preparation & Syllabus Doubt Solver
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Subject Filter Bar */}
        <div className="px-4 py-2 bg-slate-900/80 border-b border-slate-800 flex items-center gap-2 overflow-x-auto text-xs no-scrollbar">
          <BookOpen className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-indigo-500 w-full"
          >
            {SUBJECTS.map(subj => (
              <option key={subj} value={subj}>{subj}</option>
            ))}
          </select>
        </div>

        {/* Quick Question Chips */}
        <div className="px-4 py-2.5 bg-slate-900/40 border-b border-slate-800 flex gap-1.5 overflow-x-auto no-scrollbar">
          {QUICK_TOPICS.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleAsk(chip.query)}
              className="flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium bg-indigo-950/60 text-indigo-200 hover:bg-indigo-900/80 border border-indigo-800/40 transition active:scale-95"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Conversation Message List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {conversation.map((msg, i) => (
            <div
              key={i}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              {msg.sender === 'user' ? (
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl rounded-tr-none px-4 py-2.5 text-xs max-w-[85%] shadow-md">
                  {msg.text}
                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-none p-4 text-xs max-w-[95%] space-y-3 shadow-lg">
                  {/* Action buttons */}
                  <div className="flex items-center justify-between text-slate-400 pb-1 border-b border-slate-800">
                    <span className="text-[10px] font-semibold text-indigo-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> SCRE Solution
                    </span>
                    <button
                      onClick={() => handleReadAloud(msg.text)}
                      className="hover:text-white p-1 rounded transition"
                      title="Read Answer Aloud"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Body text / markdown formatted representation */}
                  <div className="text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                    {msg.text}
                  </div>

                  {/* Sample Code Snippet if present */}
                  {msg.data?.sample_code_or_formula && (
                    <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
                      <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Code2 className="w-3 h-3 text-emerald-400" /> Syntax / Code Example
                        </span>
                        <button
                          onClick={() => handleCopyCode(msg.data!.sample_code_or_formula!)}
                          className="flex items-center gap-1 hover:text-white transition"
                        >
                          {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copiedCode ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <pre className="p-3 text-[11px] text-emerald-300 font-mono overflow-x-auto whitespace-pre">
                        {msg.data.sample_code_or_formula}
                      </pre>
                    </div>
                  )}

                  {/* Exam Tip Card */}
                  {msg.data?.exam_tip && (
                    <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-2.5 flex items-start gap-2 text-amber-200 text-[11px]">
                      <Lightbulb className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-amber-300 block mb-0.5">Exam Success Tip:</strong>
                        <span>{msg.data.exam_tip}</span>
                      </div>
                    </div>
                  )}

                  {/* Related Topics */}
                  {msg.data?.related_topics && msg.data.related_topics.length > 0 && (
                    <div className="pt-2 border-t border-slate-800">
                      <p className="text-[10px] text-slate-400 font-semibold mb-1.5 flex items-center gap-1">
                        <HelpCircle className="w-3 h-3" /> Related Revision Topics:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {msg.data.related_topics.map((t, tidx) => (
                          <button
                            key={tidx}
                            onClick={() => handleAsk(`Explain ${t} in detail`)}
                            className="px-2 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-indigo-400 text-xs p-3 bg-slate-900 border border-slate-800 rounded-xl animate-pulse">
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>Analyzing curriculum & generating solution...</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-slate-900/90 border-t border-slate-800">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask formula, voucher, coding syntax..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!query.trim() || isLoading}
              className="p-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white transition active:scale-95 shadow-md shadow-indigo-500/20"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="mt-1.5 text-center">
            <span className="text-[10px] text-slate-500">
              Verified with SCRE National Curriculum & Practical Exam Syllabi
            </span>
          </div>
        </div>
      </div>
    </>
  );
};
