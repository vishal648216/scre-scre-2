import React, { useEffect, useRef } from "react";
import { Camera, Mic, ShieldAlert, AlertTriangle, Video, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface LiveProctorWidgetProps {
  mediaStream: MediaStream | null;
  hasHardwarePermission: boolean;
  hardwareError: string | null;
  checkingHardware: boolean;
  onRetryHardware?: () => void;
}

export const LiveProctorWidget: React.FC<LiveProctorWidgetProps> = ({
  mediaStream,
  hasHardwarePermission,
  hardwareError,
  checkingHardware,
  onRetryHardware,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream]);

  if (checkingHardware) {
    return (
      <div className="fixed top-4 right-4 z-50 bg-slate-900/90 backdrop-blur-md text-white px-4 py-2.5 rounded-xl border border-blue-500/30 shadow-2xl flex items-center gap-3">
        <div className="w-3 h-3 rounded-full bg-blue-500 animate-ping" />
        <span className="text-xs font-bold uppercase tracking-wider">Verifying Camera & Mic Hardware...</span>
      </div>
    );
  }

  if (!hasHardwarePermission || hardwareError) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-6 text-white text-center">
        <div className="max-w-md w-full bg-slate-900 border-2 border-rose-500/50 p-8 rounded-3xl shadow-2xl space-y-6">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-center mx-auto text-rose-500">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black uppercase tracking-tight text-rose-400">Exam Proctoring Lock</h2>
            <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">
              Camera & Microphone Hardware Mandatory
            </p>
          </div>

          <div className="p-4 bg-rose-950/50 border border-rose-500/30 rounded-xl text-left text-xs text-rose-200 leading-relaxed font-semibold">
            <p className="flex items-center gap-2 mb-2 text-rose-400 font-bold uppercase text-[10px]">
              <AlertTriangle className="w-4 h-4" /> Access Denied
            </p>
            {hardwareError || "You cannot access this examination without an active camera and microphone."}
          </div>

          <ul className="text-left text-xs text-slate-400 space-y-2">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Connect a working WebCam & Microphone.
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Allow Camera and Microphone browser permissions.
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Ensure no other application is using your camera.
            </li>
          </ul>

          {onRetryHardware && (
            <Button
              onClick={onRetryHardware}
              className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider h-11 rounded-xl"
            >
              Retry Hardware Connection
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 pointer-events-none">
      <div className="bg-slate-950/90 border-2 border-indigo-500/40 rounded-2xl p-2 shadow-2xl backdrop-blur-xl flex flex-col items-center gap-1.5 overflow-hidden w-44">
        <div className="relative w-full h-28 bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform -scale-x-100"
          />
          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-500/90 text-white text-[9px] font-black uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            REC
          </div>
          <div className="absolute bottom-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900/80 text-emerald-400 text-[9px] font-bold">
            <Mic className="w-3 h-3 animate-pulse" />
          </div>
        </div>

        <div className="flex items-center justify-between w-full px-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
          <span className="flex items-center gap-1 text-indigo-400">
            <Lock className="w-3 h-3" /> Strict CBT Mode
          </span>
          <span className="text-emerald-400">Live</span>
        </div>
      </div>
    </div>
  );
};
