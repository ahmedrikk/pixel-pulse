/**
 * Supabase SPA session storage.
 *
 * A browser application cannot create HttpOnly cookies. The previous adapter
 * duplicated access and refresh tokens into year-long JavaScript-readable
 * cookies, increasing the XSS exposure without adding real cookie security.
 * Keep the session in localStorage only; Supabase rotates refresh tokens and
 * PKCE is enabled by the client configuration.
 */

function clearLegacyCookie(key: string): void {
  if (typeof document === "undefined") return;
  const suffix = ";expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax";
  document.cookie = `${key}=${suffix}`;
  for (let index = 0; index < 10; index += 1) {
    document.cookie = `${key}.${index}=${suffix}`;
  }
}

export const persistentStorage = {
  getItem(key: string): string | null {
    if (typeof window === "undefined") return null;
    clearLegacyCookie(key);
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): void {
    if (typeof window === "undefined") return;
    clearLegacyCookie(key);
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Supabase will keep the in-memory session for the current page.
    }
  },

  removeItem(key: string): void {
    if (typeof window === "undefined") return;
    clearLegacyCookie(key);
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nothing else to clear.
    }
  },
};
