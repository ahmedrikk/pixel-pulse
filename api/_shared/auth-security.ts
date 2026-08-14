import { createClient, type Session } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";
import { z } from "zod";

export const GENERIC_LOGIN_ERROR = "Incorrect email or password";
export const GENERIC_RESET_MESSAGE = "If that email is registered, you'll receive a reset link";
export const GENERIC_SIGNUP_MESSAGE = "Check your inbox to continue creating your account";

export const emailSchema = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
export const passwordSchema = z.string().min(10).max(128).regex(/[A-Za-z]/).regex(/\d/);
export const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
  captchaToken: z.string().max(4096).optional(),
}).strict();
export const signupBodySchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  captchaToken: z.string().max(4096).optional(),
  redirectTo: z.string().url().max(2048),
}).strict();
export const resetBodySchema = z.object({
  email: emailSchema,
  redirectTo: z.string().url().max(2048),
}).strict();

const RATE_LIMIT_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then redis.call("PEXPIRE", KEYS[1], ARGV[1]) end
local ttl = redis.call("PTTL", KEYS[1])
return {current, ttl}
`;

const FAILURE_SCRIPT = `
local failures = redis.call("INCR", KEYS[1])
redis.call("PEXPIRE", KEYS[1], ARGV[1])
local locked = 0
if failures >= tonumber(ARGV[2]) then
  redis.call("SET", KEYS[2], "1", "PX", ARGV[1])
  locked = 1
end
return {failures, locked}
`;

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function rejectNonPost(request: Request): Response | null {
  if (request.method === "POST") return null;
  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json; charset=utf-8", Allow: "POST" },
  });
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > 16_384) throw new Error("REQUEST_TOO_LARGE");
  const raw = await request.text();
  if (raw.length > 16_384) throw new Error("REQUEST_TOO_LARGE");
  return JSON.parse(raw);
}

export function getRedis(): Redis {
  return new Redis({
    url: requiredEnvironment("UPSTASH_REDIS_REST_URL"),
    token: requiredEnvironment("UPSTASH_REDIS_REST_TOKEN"),
  });
}

export function getAuthClient() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)?.trim();
  const publishableKey = (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY)?.trim();
  if (!url || !publishableKey) throw new Error("Missing Supabase public server configuration");
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    "unknown"
  ).trim().slice(0, 128);
}

async function digest(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmac(value: string): Promise<string> {
  const secret = requiredEnvironment("AUTH_IDENTIFIER_SECRET");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function ipKey(request: Request, route: string): Promise<string> {
  return `auth:rate:${route}:${await digest(clientIp(request))}`;
}

export async function accountKeys(email: string): Promise<{ failures: string; locked: string; notified: string }> {
  const identifier = await hmac(email);
  return {
    failures: `auth:failures:${identifier}`,
    locked: `auth:locked:${identifier}`,
    notified: `auth:lock-notified:${identifier}`,
  };
}

export async function checkRateLimit(redis: Redis, key: string, limit: number, windowMs: number): Promise<boolean> {
  const result = await redis.eval<number[]>(RATE_LIMIT_SCRIPT, [key], [windowMs]);
  return Number(result[0]) <= limit;
}

export async function isLocked(redis: Redis, key: string): Promise<boolean> {
  return Boolean(await redis.exists(key));
}

export async function recordFailure(
  redis: Redis,
  keys: { failures: string; locked: string },
  threshold = 5,
  lockMs = 15 * 60 * 1000,
): Promise<{ failures: number; locked: boolean }> {
  const result = await redis.eval<number[]>(FAILURE_SCRIPT, [keys.failures, keys.locked], [lockMs, threshold]);
  return { failures: Number(result[0]), locked: Number(result[1]) === 1 };
}

export async function clearFailures(redis: Redis, keys: { failures: string; locked: string; notified: string }): Promise<void> {
  await redis.del(keys.failures, keys.locked, keys.notified);
}

export async function progressiveDelay(failures: number): Promise<void> {
  const exponent = Math.max(0, Math.min(failures - 1, 4));
  const baseMs = Math.min(4_000, 250 * (2 ** exponent));
  const jitterMs = Math.floor(Math.random() * 125);
  await new Promise((resolve) => setTimeout(resolve, baseMs + jitterMs));
}

export function safeSession(session: Session) {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    token_type: session.token_type,
  };
}

export function safeRedirect(value: string): string {
  const url = new URL(value);
  const allowed = new Set(
    [
      process.env.ALLOWED_WEB_ORIGINS,
      process.env.VERCEL_PROJECT_PRODUCTION_URL,
      process.env.VERCEL_URL,
    ]
      .filter(Boolean)
      .join(",")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
      .map((origin) => origin.startsWith("http") ? new URL(origin).origin : `https://${origin}`),
  );
  if (process.env.NODE_ENV !== "production") {
    allowed.add("http://localhost:8080");
    allowed.add("http://localhost:5173");
  }
  if (!allowed.has(url.origin)) throw new Error("INVALID_REDIRECT");
  return url.toString();
}
