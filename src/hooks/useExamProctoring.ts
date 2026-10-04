import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

interface UseExamProctoringOptions {
  active: boolean;
  onInstantTerminate: (reason: string) => void;
}

export interface ProctoringState {
  hasHardwarePermission: boolean;
  hardwareError: string | null;
  checkingHardware: boolean;
  mediaStream: MediaStream | null;
  audioLevel: number;
}

export function useExamProctoring({ active, onInstantTerminate }: UseExamProctoringOptions) {
  const [state, setState] = useState<ProctoringState>({
    hasHardwarePermission: false,
    hardwareError: null,
    checkingHardware: true,
    mediaStream: null,
    audioLevel: 0,
  });

  const terminatedRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);

  // 1. Hardware Check: WebCam + Microphone Requirement
  useEffect(() => {
    let isMounted = true;

    async function checkAndStartMedia() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (isMounted) {
          setState({
            hasHardwarePermission: false,
            hardwareError: "Webcam and Microphone are not supported on this browser or connection.",
            checkingHardware: false,
            mediaStream: null,
            audioLevel: 0,
          });
        }
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
          audio: true,
        });

        // Verify video and audio tracks exist
        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();

        if (videoTracks.length === 0 || audioTracks.length === 0) {
          stream.getTracks().forEach((t) => t.stop());
          if (isMounted) {
            setState({
              hasHardwarePermission: false,
              hardwareError: "Both Camera and Microphone hardware must be connected to take this exam.",
              checkingHardware: false,
              mediaStream: null,
              audioLevel: 0,
            });
          }
          return;
        }

        streamRef.current = stream;

        // Monitor if hardware gets disconnected during active exam
        videoTracks[0].onended = () => {
          if (active && !terminatedRef.current) {
            terminatedRef.current = true;
            toast.error("Camera disconnected! Exam auto-submitted.");
            onInstantTerminate("Camera hardware disconnected");
          }
        };

        audioTracks[0].onended = () => {
          if (active && !terminatedRef.current) {
            terminatedRef.current = true;
            toast.error("Microphone disconnected! Exam auto-submitted.");
            onInstantTerminate("Microphone hardware disconnected");
          }
        };

        if (isMounted) {
          setState({
            hasHardwarePermission: true,
            hardwareError: null,
            checkingHardware: false,
            mediaStream: stream,
            audioLevel: 100,
          });
        }
      } catch (err: any) {
        console.error("Proctoring Hardware Access Error:", err);
        let msg = "Camera and Microphone access is required to sit for this exam.";
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          msg = "Camera and Microphone permissions were denied. You cannot take the exam without giving access.";
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          msg = "No Camera or Microphone hardware detected on your system. Hardware is mandatory.";
        } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
          msg = "Your Camera or Microphone is already in use by another application.";
        }

        if (isMounted) {
          setState({
            hasHardwarePermission: false,
            hardwareError: msg,
            checkingHardware: false,
            mediaStream: null,
            audioLevel: 0,
          });
        }
      }
    }

    checkAndStartMedia();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [active, onInstantTerminate]);

  // 2. Strict Tab-Switching & Focus Loss Lockout (Instant Termination on tab leave)
  useEffect(() => {
    if (!active) return;

    const terminateExamNow = (reason: string) => {
      if (terminatedRef.current) return;
      terminatedRef.current = true;
      toast.error(`STRICT PROCTORING VIOLATION: ${reason}! Exam auto-submitted immediately.`);
      onInstantTerminate(reason);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        terminateExamNow("Tab switch / Window minimized detected");
      }
    };

    const handleWindowBlur = () => {
      // Window lost focus (alt-tabbed or clicked outside)
      terminateExamNow("Focus lost / Window switch detected");
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        terminateExamNow("Exited Fullscreen mode");
      }
    };

    // Anti-copy, anti-paste, anti-contextmenu, key combos
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      toast.error("Right-click context menu is disabled!");
    };

    const handleCopyCutPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      toast.error("Copying, cutting, and pasting are strictly prohibited!");
    };

    const handleSelectStart = (e: Event) => {
      e.preventDefault();
    };

    const handleKeyCombo = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      // Block Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A, Ctrl+P, Ctrl+U, Ctrl+S, Alt+Tab, F12
      if ((e.ctrlKey || e.metaKey) && ["c", "v", "x", "a", "p", "u", "s"].includes(key)) {
        e.preventDefault();
        toast.error(`Shortcut Ctrl+${key.toUpperCase()} is disabled!`);
      }
      if (e.key === "F12" || (e.ctrlKey && e.shiftKey && (key === "i" || key === "c" || key === "j"))) {
        e.preventDefault();
        toast.error("Developer Tools are disabled!");
      }
      if (e.altKey && e.key === "Tab") {
        e.preventDefault();
        terminateExamNow("Alt+Tab window switch attempt");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleCopyCutPaste);
    document.addEventListener("cut", handleCopyCutPaste);
    document.addEventListener("paste", handleCopyCutPaste);
    document.addEventListener("selectstart", handleSelectStart);
    document.addEventListener("keydown", handleKeyCombo);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleCopyCutPaste);
      document.removeEventListener("cut", handleCopyCutPaste);
      document.removeEventListener("paste", handleCopyCutPaste);
      document.removeEventListener("selectstart", handleSelectStart);
      document.removeEventListener("keydown", handleKeyCombo);
    };
  }, [active, onInstantTerminate]);

  return state;
}
