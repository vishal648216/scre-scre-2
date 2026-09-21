import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";

/**
 * Tracks tab/window visibility during an attempt. Events are strings for `submit.security_events`.
 */
export function useExamV2Security(active: boolean) {
  const [events, setEvents] = useState<string[]>([]);
  const tabSwitches = useRef(0);

  const push = useCallback((e: string) => {
    setEvents((prev) => [...prev, e]);
  }, []);

  useEffect(() => {
    if (!active) return;

    const onVis = () => {
      if (document.hidden) {
        tabSwitches.current += 1;
        const id = `tab_hidden_${Date.now()}`;
        push(id);
        toast.warning("Stay in this tab — switching away may be reported.", { duration: 4000 });
      }
    };

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [active, push]);

  return { securityEvents: events, tabSwitchCount: tabSwitches.current };
}
