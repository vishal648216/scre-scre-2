/** Public, unauthenticated system settings (home page, cursor, popups). */
export const PUBLIC_SYSTEM_SETTINGS_QUERY_KEY = ["public-system-settings"] as const;

export async function fetchPublicSystemSettings(): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch("/api/public/system-settings");
    if (!res.ok) return null;
    const data = await res.json();
    return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
