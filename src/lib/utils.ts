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

export function normalizeAssetUrl(url?: string): string {
  let u = (url || "").trim();
  if (!u || u === "#" || u.includes("example.com")) return "";

  const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "");

  // Convert "uploads/..." to "/uploads/..."
  if (u.startsWith("uploads/")) {
    u = `/${u}`;
  }

  // Replace localhost / 127.0.0.1 URLs with apiBase in production
  if (u.includes("localhost:3008") || u.includes("localhost:3002") || u.includes("127.0.0.1")) {
    if (apiBase && !apiBase.includes("localhost") && !apiBase.includes("127.0.0.1")) {
      return u.replace(/http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, apiBase);
    }
  }

  // Handle uploaded assets
  if (u.startsWith("/uploads/")) {
    if (apiBase && !apiBase.includes("localhost") && !apiBase.includes("127.0.0.1")) {
      return `${apiBase}${u}`;
    }
    return u;
  }

  // Handle public static images (e.g. /images/...)
  if (u.startsWith("/images/")) {
    return u;
  }

  if (u.startsWith("/")) {
    if (apiBase && !apiBase.includes("localhost") && !apiBase.includes("127.0.0.1")) {
      return `${apiBase}${u}`;
    }
    return u;
  }

  if (window.location.protocol === "https:" && u.startsWith("http://")) {
    try {
      const parsed = new URL(u);
      if (parsed.hostname === window.location.hostname || (apiBase && parsed.hostname === new URL(apiBase).hostname)) {
        parsed.protocol = "https:";
        return parsed.toString();
      }
    } catch { /* ignore */ }
  }

  return u;
}

