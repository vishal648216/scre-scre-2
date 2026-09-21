/** Optional absolute API origin for production when the SPA is served without `/api` → backend proxy (set in `.env`). */
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";

/** Build full URL for API calls (honours `VITE_API_BASE_URL` when Apache/nginx does not proxy `/api`). */
export function apiUrl(path: string): string {
  if (!path.startsWith("/")) return `${API_BASE}/${path}`;
  return `${API_BASE}${path}`;
}

export async function apiFetch(path: string, init?: RequestInit) {
  const token = sessionStorage.getItem("token");
  const language =
    (localStorage.getItem("lang") || document.documentElement.getAttribute("lang") || "en")
      .split("-")[0]
      .toLowerCase();
  const headers = {
    ...(init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
    ...(init?.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Accept-Language": language,
  } as Record<string, string>;
  const res = await fetch(apiUrl(path), { ...(init || {}), headers });

  if (res.status === 401) {
    const hadSession = Boolean(token);
    if (hadSession) {
      console.warn("Unauthorized request detected (401). Clearing session and redirecting to login.");
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("user");
      if (window.location.pathname !== "/") {
        window.location.href = "/?login=true";
      }
    }
    // Anonymous 401s (e.g. misconfigured proxy or wrong route) must not send users to /?login=true
  }

  return res;
}

/** Use for endpoints that must return a JSON array; avoids `.map` crashes on error objects or HTML. */
export async function parseJsonArrayResponse(res: Response): Promise<unknown[]> {
  if (!res.ok) return [];
  try {
    const data = await res.json();
    const array = Array.isArray(data) ? data : [];
    
    // Recursive function to flatten MongoDB special types
    const flatten = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;
      
      if (Array.isArray(obj)) return obj.map(flatten);
      
      if (obj.$oid) return obj.$oid;
      if (obj.$date) {
        const val = obj.$date.$numberLong || obj.$date;
        if (typeof val === 'object') return val;
        const num = Number(val);
        // If it's a numeric string or number, parse it as a timestamp.
        // Otherwise, if it's already an ISO string, return as is.
        if (!isNaN(num) && /^\d+$/.test(String(val))) {
          return new Date(num).toISOString();
        }
        return String(val);
      }
      
      const newObj: any = {};
      for (const [key, value] of Object.entries(obj)) {
        newObj[key] = flatten(value);
      }
      return newObj;
    };

    return array.map(flatten);
  } catch {
    return [];
  }
}
