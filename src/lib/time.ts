import { apiFetch } from "./api";
import { useState, useEffect } from "react";

let serverOffset = 0;
let isSynced = false;
let syncPromise: Promise<void> | null = null;
const listeners: ((synced: boolean) => void)[] = [];

function notifyListeners() {
  listeners.forEach((l) => l(isSynced));
}

/**
 * Synchronize the client time with the server time.
 * This should be called once when the application starts.
 */
export async function syncServerTime() {
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    try {
      const startTime = Date.now();
      const response = await apiFetch("/api/public/system/time");
      const endTime = Date.now();
      
      if (response.ok) {
        const data = await response.json();
        const serverTime = data.timestamp;
        
        // Calculate offset, accounting for network latency (roughly half the round-trip time)
        const latency = (endTime - startTime) / 2;
        serverOffset = serverTime + latency - endTime;
        isSynced = true;
        notifyListeners();
        console.log(`[TimeSync] Server time offset: ${serverOffset}ms (latency: ${latency}ms, server: ${new Date(serverTime).toISOString()}, client: ${new Date(endTime).toISOString()})`);
      } else {
        console.error(`[TimeSync] Failed to sync server time: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error("[TimeSync] Failed to sync server time:", error);
    } finally {
      syncPromise = null;
    }
  })();

  return syncPromise;
}

/**
 * Returns the current date/time synchronized with the server.
 */
export function getServerNow(): Date {
  return new Date(Date.now() + serverOffset);
}

/**
 * Checks if the time has been synchronized with the server.
 */
export function isTimeSynced(): boolean {
  return isSynced;
}

/**
 * Hook to track synchronization status.
 */
export function useTimeSync() {
  const [synced, setSynced] = useState(isTimeSynced());

  useEffect(() => {
    const listener = (s: boolean) => setSynced(s);
    listeners.push(listener);
    if (isSynced !== synced) setSynced(isSynced);
    
    return () => {
      const idx = listeners.indexOf(listener);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }, []);

  return synced;
}

const IST_TZ = "Asia/Kolkata";

function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) {
    return isNaN(v.getTime()) ? null : v;
  }
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v as string | number);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("$date" in o) {
      const d = o.$date;
      if (typeof d === "number") return new Date(d);
      if (typeof d === "string") return new Date(d);
      if (d && typeof d === "object" && "$numberLong" in (d as Record<string, unknown>)) {
        return new Date(parseInt(String((d as Record<string, unknown>).$numberLong)));
      }
    }
  }
  return null;
}

export function formatISTDate(iso: unknown, style: "short" | "long" = "short"): string {
  const d = toDate(iso);
  if (!d) return "N/A";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: style === "short" ? "short" : "long",
    year: "numeric",
    timeZone: IST_TZ,
  }).format(d);
}

export function formatISTTime(iso: unknown, withSeconds = false): string {
  const d = toDate(iso);
  if (!d) return "N/A";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
    hour12: true,
    timeZone: IST_TZ,
  }).format(d);
}

export function formatISTDateTime(iso: unknown): string {
  const d = toDate(iso);
  if (!d) return "N/A";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: IST_TZ,
  }).format(d);
}

export function formatISTDateTimeLong(iso: unknown): string {
  const d = toDate(iso);
  if (!d) return "N/A";
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: IST_TZ,
  }).format(d);
}
