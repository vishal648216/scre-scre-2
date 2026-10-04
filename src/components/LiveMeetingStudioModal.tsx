import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Radio,
  ExternalLink,
  ShieldCheck,
  Zap,
  Users,
  Maximize2,
  Minimize2,
  RefreshCw,
  Video,
  UserCheck,
  GraduationCap,
  Building2,
} from "lucide-react";

interface LiveMeetingStudioModalProps {
  open: boolean;
  onClose: () => void;
  meeting: {
    id: string;
    title: string;
    platform: string;
    join_url: string;
    meeting_type?: string;
    joined_count?: number;
  } | null;
  userDisplayName?: string;
  isHost?: boolean;
  onEndMeeting?: () => void;
}

const SERVER_PROVIDERS = [
  { id: "jitsi_primary", name: "SCRE Native HD Server (No Password)", base: "https://meet.jit.si/" },
  { id: "freifunk", name: "Freifunk Secure Server (Fast)", base: "https://meet.ffm.freifunk.net/" },
  { id: "element", name: "Element Open Room (Fallback)", base: "https://meet.element.io/" },
];

export default function LiveMeetingStudioModal({
  open,
  onClose,
  meeting,
  userDisplayName = "Participant",
  isHost = false,
  onEndMeeting,
}: LiveMeetingStudioModalProps) {
  const [providerIndex, setProviderIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  useEffect(() => {
    if (open) {
      setIframeKey((prev) => prev + 1);
    }
  }, [open, meeting?.id, providerIndex]);

  if (!meeting) return null;

  // Extract room ID or construct clean room name
  const getRoomName = () => {
    if (meeting.join_url && meeting.join_url.includes("/")) {
      const parts = meeting.join_url.split("/");
      const lastPart = parts[parts.length - 1].split("#")[0].split("?")[0];
      if (lastPart && lastPart.length > 3) return lastPart;
    }
    return `scre-live-meeting-${meeting.id}`;
  };

  const roomName = getRoomName();
  const currentProvider = SERVER_PROVIDERS[providerIndex];

  // Construct iframe embed URL with auto-login fragment parameters
  const isJitsiPlatform = meeting.platform === "jitsi" || !meeting.join_url || meeting.join_url.includes("jit.si") || meeting.join_url.includes("freifunk") || meeting.join_url.includes("element");

  let embedUrl = meeting.join_url;

  if (isJitsiPlatform) {
    const cleanDisplayName = encodeURIComponent(userDisplayName || (isHost ? "Center Host" : "Student Participant"));
    embedUrl = `${currentProvider.base}${roomName}#userInfo.displayName="${cleanDisplayName}"&config.prejoinPageEnabled=false&config.requireDisplayName=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false&config.disableDeepLinking=true&config.enableLobby=false&config.openBridgeChannel=true`;
  }

  const meetingTypeBadge = () => {
    switch (meeting.meeting_type) {
      case "ptm_parent_meeting":
        return { label: "PTM Parent Connect", icon: UserCheck, color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" };
      case "staff_director_meeting":
        return { label: "Staff & Management", icon: Building2, color: "bg-purple-500/10 text-purple-400 border-purple-500/30" };
      default:
        return { label: "Academic Live Class", icon: GraduationCap, color: "bg-blue-500/10 text-blue-400 border-blue-500/30" };
    }
  };

  const badgeInfo = meetingTypeBadge();
  const TypeIcon = badgeInfo.icon;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={`p-0 gap-0 border-0 bg-slate-950 text-white overflow-hidden shadow-2xl transition-all duration-300 ${isFullscreen ? "max-w-[100vw] h-[100vh] rounded-none" : "max-w-6xl h-[88vh] rounded-2xl border border-slate-800"}`}>
        {/* Top Control Bar */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-900/90 border-b border-slate-800/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm sm:text-base truncate text-white">{meeting.title}</h2>
                <Badge variant="outline" className={`text-[10px] px-2 py-0.5 border ${badgeInfo.color}`}>
                  <TypeIcon className="w-3 h-3 mr-1 inline" />
                  {badgeInfo.label}
                </Badge>
                {isHost && (
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]">
                    👑 Room Host
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                <span>Joined as: <strong className="text-white">{userDisplayName}</strong></span>
                <span>•</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Password-Free Secure Encryption
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Server Switcher for Jitsi fallback */}
            {isJitsiPlatform && (
              <select
                value={providerIndex}
                onChange={(e) => setProviderIndex(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                title="Switch video server if connection is slow"
              >
                {SERVER_PROVIDERS.map((p, idx) => (
                  <option key={p.id} value={idx}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIframeKey((k) => k + 1)}
              className="text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
              title="Reload Camera & Audio"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => window.open(embedUrl, "_blank")}
              className="text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg hidden sm:flex gap-1 text-xs"
              title="Open in new browser tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Tab View
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>

            {isHost && onEndMeeting && (
              <Button
                size="sm"
                onClick={() => {
                  onEndMeeting();
                }}
                className="bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-lg px-3 py-1.5 text-xs gap-1.5 shadow-lg shadow-red-600/30 animate-pulse"
                title="End & Close Live Broadcast for all participants"
              >
                <X className="w-3.5 h-3.5" />
                End Meeting (Stop Live)
              </Button>
            )}

            <Button
              size="sm"
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg px-3 py-1.5 text-xs gap-1"
            >
              <X className="w-3.5 h-3.5" />
              Leave Room
            </Button>
          </div>
        </div>

        {/* Embedded Iframe Meeting Container */}
        <div className="relative flex-1 w-full h-full bg-black min-h-[500px]">
          <iframe
            key={iframeKey}
            src={embedUrl}
            className="w-full h-full border-0 absolute inset-0"
            allow="camera; microphone; display-capture; autoplay; clipboard-write; encrypted-media; fullscreen"
            allowFullScreen
          />
        </div>

        {/* Bottom Bar Info */}
        <div className="flex items-center justify-between px-5 py-2 bg-slate-950 border-t border-slate-900 text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <Zap className="w-3.5 h-3.5" /> Active Live Room Studio
            </span>
            <span>•</span>
            <span>Microphone & Camera Enabled</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Powered by SCRE Enterprise Live Engine</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
