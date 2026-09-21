import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Send, Loader2, User, MessageSquare, Search, Plus, QrCode, Shield, ShieldOff, Check, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { QRCodeSVG } from "qrcode.react";
import { apiFetch } from "@/lib/api";

interface Message {
  _id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
}

interface ChatPartner {
  _id: any;
  username: string;
  full_name?: string;
  fullName?: string;
  role: string;
}

const toId = (v: any): string => {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "$oid" in v) return v.$oid;
  return String(v || "");
};

const MessagingPage = () => {
  const [partners, setPartners] = useState<ChatPartner[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<ChatPartner | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [user, setUser] = useState<any>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchUsername, setSearchUsername] = useState("");
  const [searching, setSearching] = useState(false);
  const [showMyQr, setShowMyQr] = useState(false);
  const [isWallEnabled, setIsWallEnabled] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedUser = sessionStorage.getItem("user");
    if (storedUser) setUser(JSON.parse(storedUser));
    fetchRecentChats();
    fetchSystemSettings();
  }, []);

  useEffect(() => {
    if (selectedPartner) {
      const id = toId(selectedPartner._id);
      if (id) fetchMessages(id);
    }
  }, [selectedPartner]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchSystemSettings = async () => {
    try {
      const res = await apiFetch("/api/public/system-settings");
      if (res.ok) {
        const settings = await res.json();
        setIsWallEnabled(settings.is_messaging_wall_enabled);
      }
    } catch (e) {
      console.error("Failed to fetch settings");
    }
  };

  const toggleWall = async () => {
    try {
      const res = await apiFetch("/api/system/settings", {
        method: "PUT",
        body: JSON.stringify({ is_messaging_wall_enabled: !isWallEnabled })
      });
      if (res.ok) {
        setIsWallEnabled(!isWallEnabled);
        toast.success(`Messaging Wall ${!isWallEnabled ? 'Enabled' : 'Disabled'}`);
      }
    } catch (e) {
      toast.error("Failed to update settings");
    }
  };

  const fetchRecentChats = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/messages/recent");
      if (res.ok) {
        const data = await res.json();
        setPartners(data);
      }
    } catch (e) {
      toast.error("Failed to load chats");
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (otherId: string) => {
    try {
      const res = await apiFetch(`/api/messages/${otherId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearchUser = async () => {
    if (!searchUsername.trim()) return;
    setSearching(true);
    try {
      const res = await apiFetch(`/api/messages/user/${searchUsername}`);
      if (res.ok) {
        const targetUser = await res.json();
        if (targetUser) {
          // Add to temporary list if not already there
          if (!partners.some(p => toId(p._id) === toId(targetUser._id))) {
            setPartners([targetUser, ...partners]);
          }
          setSelectedPartner(targetUser);
          setShowNewChat(false);
          setSearchUsername("");
        } else {
          toast.error("User not found");
        }
      } else {
        toast.error("User not found");
      }
    } catch (e) {
      toast.error("Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartner || !newMessage.trim()) return;

    const id = toId(selectedPartner._id);
    if (!id) return;

    setSending(true);
    try {
      const res = await apiFetch("/api/messages", {
        method: "POST",
        body: JSON.stringify({
          recipient_id: id,
          content: newMessage
        })
      });

      if (res.ok) {
        setNewMessage("");
        fetchMessages(id);
      } else {
        const err = await res.json();
        toast.error(err.message || "Message blocked by boundary wall");
      }
    } catch (e) {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const isAdmin = user?.role?.toLowerCase() === "admin" || user?.role?.toLowerCase() === "superadmin";

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-160px)] flex bg-card border border-border overflow-hidden relative">
        {/* Sidebar */}
        <div className="w-80 border-r border-border flex flex-col bg-muted/5">
          <div className="p-4 border-b border-border bg-muted/10 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-primary">
                <MessageSquare className="w-4 h-4" />
                Conversations
              </h2>
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowMyQr(true)}
                  className="p-2 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors border border-transparent hover:border-primary/20"
                  title="My QR Code"
                >
                  <QrCode className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setShowNewChat(true)}
                  className="p-2 bg-primary text-primary-foreground hover:opacity-90 shadow-lg"
                  title="New Chat"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {isAdmin && (
              <button 
                onClick={toggleWall}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 text-[9px] font-black uppercase tracking-[0.2em] border transition-all",
                  isWallEnabled 
                    ? "bg-emerald-500/5 text-emerald-500 border-emerald-500/20" 
                    : "bg-destructive/5 text-destructive border-destructive/20"
                )}
              >
                <div className="flex items-center gap-2">
                  {isWallEnabled ? <Shield className="w-3 h-3" /> : <ShieldOff className="w-3 h-3" />}
                  Boundary Wall: {isWallEnabled ? "ON" : "OFF"}
                </div>
                <div className={cn(
                  "w-8 h-4 rounded-full relative transition-colors",
                  isWallEnabled ? "bg-emerald-500" : "bg-destructive"
                )}>
                  <div className={cn(
                    "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all",
                    isWallEnabled ? "right-0.5" : "left-0.5"
                  )} />
                </div>
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            ) : partners.length === 0 ? (
              <div className="p-10 text-center space-y-4">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto opacity-20">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">No active chats</p>
                <button 
                  onClick={() => setShowNewChat(true)}
                  className="text-[9px] font-black text-primary uppercase border-b border-primary/30 hover:border-primary transition-all"
                >
                  Start New Conversation
                </button>
              </div>
            ) : (
              partners.map(p => {
                const id = toId(p._id);
                const name = p.full_name || p.fullName || p.username;
                return (
                  <button
                    key={id}
                    onClick={() => setSelectedPartner(p)}
                    className={cn(
                      "w-full p-4 flex items-center gap-4 hover:bg-primary/5 transition-all border-b border-border/50 text-left",
                      selectedPartner && toId(selectedPartner._id) === id && "bg-primary/5 border-l-4 border-l-primary"
                    )}
                  >
                    <div className="w-10 h-10 bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-[11px] font-black uppercase tracking-tight truncate">{name}</p>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{p.role}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedPartner ? (
            <>
              <div className="p-4 border-b border-border flex items-center justify-between bg-muted/10">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary/10 flex items-center justify-center border border-primary/20">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-tight">{selectedPartner.full_name || selectedPartner.fullName || selectedPartner.username}</p>
                    <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">Secure Channel • {selectedPartner.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 bg-primary/5 text-primary border border-primary/10">
                    UID: {selectedPartner.username}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-muted/5">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-30">
                    <MessageSquare className="w-12 h-12 mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-[0.3em]">No messages yet. Say hello!</p>
                  </div>
                ) : (
                  messages.map(m => {
                    const isMe = m.sender_id !== toId(selectedPartner._id);
                    return (
                      <div key={m._id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[70%] p-4 text-sm font-medium shadow-sm border relative",
                          isMe ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border"
                        )}>
                          <p>{m.content}</p>
                          <p className={cn(
                            "text-[8px] font-bold uppercase tracking-widest mt-2",
                            isMe ? "text-primary-foreground/70" : "text-muted-foreground"
                          )}>
                            {format(new Date(m.created_at), "hh:mm a")}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={scrollRef} />
              </div>

              <form onSubmit={handleSend} className="p-4 bg-card border-t border-border flex gap-4">
                <input 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message here..."
                  className="flex-1 px-6 py-4 bg-muted/50 border border-border text-sm font-bold focus:border-primary outline-none transition-all"
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="px-8 bg-primary text-primary-foreground font-heading font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:opacity-90 transition-all flex items-center gap-3 disabled:opacity-50"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center opacity-20">
              <MessageSquare className="w-20 h-20 mb-6" />
              <p className="text-sm font-black uppercase tracking-[0.4em]">Select a contact to message</p>
            </div>
          )}
        </div>

        {/* New Chat Modal */}
        {showNewChat && (
          <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6">
            <Card className="w-full max-w-md rounded-none border-primary shadow-2xl overflow-hidden">
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-widest text-primary">Add New Conversation</h3>
                  <button onClick={() => setShowNewChat(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
                </div>
                <div className="space-y-4">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase leading-relaxed">
                    Enter the unique username or Student ID of the person you want to connect with.
                  </p>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input 
                      autoFocus
                      placeholder="USERNAME / STUDENT ID..." 
                      className="w-full pl-11 pr-4 py-4 bg-muted/50 border border-border text-sm font-black uppercase tracking-widest focus:border-primary outline-none"
                      value={searchUsername}
                      onChange={(e) => setSearchUsername(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchUser()}
                    />
                  </div>
                  <button 
                    onClick={handleSearchUser}
                    disabled={searching || !searchUsername.trim()}
                    className="w-full py-4 bg-primary text-primary-foreground font-black text-xs uppercase tracking-[0.2em] shadow-xl flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Start Chat
                  </button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* QR Code Modal */}
        {showMyQr && (
          <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6">
            <Card className="w-full max-w-xs rounded-none border-primary shadow-2xl overflow-hidden">
              <div className="p-8 text-center space-y-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">Your Chat ID</h3>
                  <button onClick={() => setShowMyQr(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                </div>
                <div className="bg-white p-4 border border-border inline-block mx-auto">
                  <QRCodeSVG value={user?.username || ""} size={180} level="H" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-black uppercase tracking-tight">{user?.username}</p>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Scan this code to connect</p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default MessagingPage;
