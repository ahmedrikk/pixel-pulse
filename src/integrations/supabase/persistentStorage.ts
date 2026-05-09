/**
 * Hybrid storage for Supabase auth: writes to both localStorage AND cookies.
 * Cookies survive when localStorage is cleared (some browser settings, incognito edge cases).
 * Reads prefer localStorage (faster, larger), fall back to cookies.
 *
 * Cookie expiry: 365 days. Cookies are split into 3.5KB chunks since Supabase
 * session JSON can exceed the 4KB per-cookie browser limit.
 */

const COOKIE_MAX_AGE_DAYS = 365;
const COOKIE_CHUNK_SIZE = 3500;

function setCookie(name: string, value: string): void {
  const expires = new Date(Date.now() + COOKIE_MAX_AGE_DAYS * 86400000).toUTCString();
  const isSecure = typeof location !== 'undefined' && location.protocol === 'https:';
  const secureFlag = isSecure ? ';Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax${secureFlag}`;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.$?*|{}()[\]\\/+^]/g, '\\$&') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function deleteCookie(name: string): void {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
}

function setCookieChunked(key: string, value: string): void {
  // Clear any existing chunks first
  for (let i = 0; i < 10; i++) deleteCookie(`${key}.${i}`);
  deleteCookie(key);

  if (value.length <= COOKIE_CHUNK_SIZE) {
    setCookie(key, value);
    return;
  }

  const chunks = Math.ceil(value.length / COOKIE_CHUNK_SIZE);
  setCookie(key, `__chunked__${chunks}`);
  for (let i = 0; i < chunks; i++) {
    const chunk = value.slice(i * COOKIE_CHUNK_SIZE, (i + 1) * COOKIE_CHUNK_SIZE);
    setCookie(`${key}.${i}`, chunk);
  }
}

function getCookieChunked(key: string): string | null {
  const head = getCookie(key);
  if (!head) return null;
  const chunkMatch = head.match(/^__chunked__(\d+)$/);
  if (!chunkMatch) return head;
  const chunks = parseInt(chunkMatch[1], 10);
  let combined = '';
  for (let i = 0; i < chunks; i++) {
    const part = getCookie(`${key}.${i}`);
    if (part === null) return null;
    combined += part;
  }
  return combined;
}

function deleteCookieChunked(key: string): void {
  deleteCookie(key);
  for (let i = 0; i < 10; i++) deleteCookie(`${key}.${i}`);
}

export const persistentStorage = {
  getItem(key: string): string | null {
    if (typeof window === 'undefined') return null;
    try {
      const ls = window.localStorage.getItem(key);
      if (ls) return ls;
    } catch {}
    try {
      return getCookieChunked(key);
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, value);
    } catch {}
    try {
      setCookieChunked(key, value);
    } catch {}
  },

  removeItem(key: string): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch {}
    try {
      deleteCookieChunked(key);
    } catch {}
  },
};
