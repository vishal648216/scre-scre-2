import { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Send, Loader2, Bot, Sparkles, User, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { format } from "date-fns";

interface ChatMessage {
  id?: string;
  _id?: string;
  sender_id: string;
  sender_role: string;
  recipient_id: string;
  content: string;
  created_at: string;
}

export function LiveChatDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [user, setUser] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("user");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (isOpen && user) {
      fetchChatMessages();
    }
  }, [isOpen, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchChatMessages = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Connect to parent_id (center) if student, or admin if center
      const targetId = user.parent_id || user.center_id;
      if (targetId) {
        const res = await apiFetch(`/api/messages/${targetId}`);
        if (res.ok) {
          const data = await res.json();
          setMessages(Array.isArray(data) ? data : []);
        }
      }
    } catch (e) {
      console.error("Live chat fetch error", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !user) return;
    const targetId = user.parent_id || user.center_id;
    if (!targetId) {
      // Fallback welcome message
      setMessages(prev => [
        ...prev,
        {
          sender_id: user.id || user._id,
          sender_role: user.role || "student",
          recipient_id: "support",
          content: inputMessage,
          created_at: new Date().toISOString(),
        },
        {
          sender_id: "support",
          sender_role: "admin",
          recipient_id: user.id || user._id,
          content: "Thank you for reaching out! Our counselors and academic team have received your note and will reply shortly. For formal requests, please use the Helpdesk page.",
          created_at: new Date().toISOString(),
        }
      ]);
      setInputMessage("");
      return;
    }

    setSending(true);
    try {
      const res = await apiFetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_id: targetId,
          content: inputMessage.trim(),
        }),
      });

      if (res.ok) {
        setMessages(prev => [
          ...prev,
          {
            sender_id: user.id || user._id,
            sender_role: user.role || "student",
            recipient_id: targetId,
            content: inputMessage.trim(),
            created_at: new Date().toISOString(),
          }
        ]);
        setInputMessage("");
      }
    } catch (e) {
      console.error("Send message error", e);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <Button
            onClick={() => setIsOpen(true)}
            className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-2xl hover:scale-105 transition-all flex items-center justify-center p-0 border-2 border-background"
            aria-label="Open Live Chat Support"
          >
            <MessageSquare className="w-6 h-6" />
          </Button>
        </div>
      )}

      {/* Floating Chat Modal / Drawer */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[92vw] sm:w-[380px] h-[520px] bg-card border border-border shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="bg-primary text-primary-foreground p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-sm tracking-tight leading-none">
                  SCRE Live Helpdesk
                </h4>
                <p className="text-[11px] text-primary-foreground/80 mt-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Instant Student & Center Support
                </p>
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8 text-primary-foreground hover:bg-white/20 rounded-full"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/10 text-xs">
            {/* Greeting */}
            <div className="p-3 bg-primary/10 border border-primary/20 text-foreground">
              <p className="font-semibold text-primary mb-1 flex items-center gap-1">
                <Bot className="w-3.5 h-3.5" /> Welcome to SCRE Support
              </p>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Need urgent help with your admissions, classes, examination admit card, or verification? Send us a quick note below!
              </p>
            </div>

            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <HelpCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No recent messages.</p>
                <p className="text-[11px]">Type below to start chatting with support.</p>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isMe = user && (msg.sender_id === user.id || msg.sender_id === user._id);
                return (
                  <div
                    key={idx}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[82%] px-3.5 py-2.5 rounded-none text-xs ${
                        isMe
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted border border-border text-foreground"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-0.5 px-1">
                      {format(new Date(msg.created_at || Date.now()), "hh:mm a")}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
          <form onSubmit={handleSendMessage} className="p-3 border-t bg-card flex items-center gap-2">
            <Input
              placeholder="Type your message..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              className="rounded-none h-10 text-xs flex-1"
            />
            <Button
              type="submit"
              disabled={sending || !inputMessage.trim()}
              size="icon"
              className="rounded-none h-10 w-10 shrink-0 bg-primary text-primary-foreground"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        </div>
      )}
    </>
  );
}

export default LiveChatDrawer;
