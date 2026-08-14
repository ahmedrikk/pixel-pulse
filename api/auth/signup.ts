import {
  checkRateLimit,
  GENERIC_SIGNUP_MESSAGE,
  getAuthClient,
  getRedis,
  ipKey,
  json,
  readJsonBody,
  rejectNonPost,
  safeRedirect,
  safeSession,
  signupBodySchema,
} from "../_shared/auth-security";

export const config = { runtime: "edge" };

export default async function handler(request: Request): Promise<Response> {
  const methodError = rejectNonPost(request);
  if (methodError) return methodError;

  try {
    const parsed = signupBodySchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return json({ error: "Unable to create account with those details" }, 400);

    const redis = getRedis();
    const allowed = await checkRateLimit(redis, await ipKey(request, "signup"), 5, 60 * 60 * 1000);
    if (!allowed) return json({ message: GENERIC_SIGNUP_MESSAGE });

    const auth = getAuthClient();
    const { data, error } = await auth.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        captchaToken: parsed.data.captchaToken || undefined,
        emailRedirectTo: safeRedirect(parsed.data.redirectTo),
      },
    });

    // Existing-email and signup-provider errors deliberately receive the same response.
    if (error || !data.session) return json({ message: GENERIC_SIGNUP_MESSAGE });
    return json({ message: GENERIC_SIGNUP_MESSAGE, session: safeSession(data.session) });
  } catch {
    return json({ error: "Account creation is temporarily unavailable" }, 503);
  }
}
