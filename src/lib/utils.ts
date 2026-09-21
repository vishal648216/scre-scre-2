import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toId(id: any): string {
  if (!id) return "";
  if (typeof id === "string") return id;
  if (typeof id === "object") {
    if (id.$oid) return id.$oid;
    if (id._id) return toId(id._id);
    if (id.toString) return id.toString();
  }
  return String(id);
}

export function normalizeAssetUrl(url?: string) {
  const u = (url || "").trim();
  if (!u) return "";
  // If it's a relative upload path like /uploads/admins/..., just return it
  if (u.startsWith("/uploads/")) {
    return u;
  }
  if (u.startsWith("/")) {
    const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "");
    const origin = apiBase || window.location.origin;
    return `${origin}${u}`;
  }
  if (window.location.protocol === "https:" && u.startsWith("http://")) {
    try {
      const parsed = new URL(u);
      if (parsed.hostname === window.location.hostname) {
        parsed.protocol = "https:";
        return parsed.toString();
      }
    } catch { /* ignore */ }
  }
  return u;
}
