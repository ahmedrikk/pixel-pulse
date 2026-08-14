import { supabase } from "@/integrations/supabase/client";

export const GENERIC_LOGIN_ERROR = "Incorrect email or password";
export const GENERIC_RESET_MESSAGE = "If that email is registered, you'll receive a reset link";

type ApiSession = {
  access_token: string;
  refresh_token: string;
};

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "Request could not be completed");
  return payload;
}

async function persistSession(session?: ApiSession): Promise<boolean> {
  if (!session) return false;
  const { error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (error) throw new Error("Authentication is temporarily unavailable");
  return true;
}

export async function loginWithPassword(email: string, password: string, captchaToken?: string): Promise<void> {
  const payload = await post<{ session: ApiSession }>("/api/auth/login", { email, password, captchaToken });
  await persistSession(payload.session);
}

export async function signupWithPassword(
  email: string,
  password: string,
  redirectTo: string,
  captchaToken?: string,
): Promise<{ signedIn: boolean }> {
  const payload = await post<{ session?: ApiSession }>("/api/auth/signup", { email, password, redirectTo, captchaToken });
  return { signedIn: await persistSession(payload.session) };
}

export async function requestPasswordReset(email: string, redirectTo: string): Promise<string> {
  const payload = await post<{ message: string }>("/api/auth/reset-password", { email, redirectTo });
  return payload.message || GENERIC_RESET_MESSAGE;
}
