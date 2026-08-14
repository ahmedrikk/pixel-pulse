import {
  accountKeys,
  checkRateLimit,
  clearFailures,
  GENERIC_LOGIN_ERROR,
  getAuthClient,
  getRedis,
  ipKey,
  isLocked,
  json,
  loginBodySchema,
  progressiveDelay,
  readJsonBody,
  recordFailure,
  rejectNonPost,
  safeRedirect,
  safeSession,
} from "../_shared/auth-security";

export const config = { runtime: "edge" };

const LOCK_MS = 15 * 60 * 1000;

export default async function handler(request: Request): Promise<Response> {
  const methodError = rejectNonPost(request);
  if (methodError) return methodError;

  try {
    const redis = getRedis();
    const ipAllowed = await checkRateLimit(redis, await ipKey(request, "login"), 10, 60_000);
    if (!ipAllowed) {
      await progressiveDelay(5);
      return json({ error: GENERIC_LOGIN_ERROR }, 401);
    }

    const parsed = loginBodySchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return json({ error: GENERIC_LOGIN_ERROR }, 401);

    const keys = await accountKeys(parsed.data.email);
    if (await isLocked(redis, keys.locked)) {
      await progressiveDelay(5);
      return json({ error: GENERIC_LOGIN_ERROR }, 401);
    }

    const auth = getAuthClient();
    const { data, error } = await auth.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { captchaToken: parsed.data.captchaToken || undefined },
    });

    if (error || !data.session) {
      const state = await recordFailure(redis, keys, 5, LOCK_MS);
      if (state.locked) {
        const firstNotification = await redis.set(keys.notified, "1", { nx: true, px: LOCK_MS });
        if (firstNotification === "OK") {
          try {
            const redirectTo = safeRedirect(`${new URL(request.url).origin}/login`);
            await auth.auth.resetPasswordForEmail(parsed.data.email, { redirectTo });
          } catch {
            // Notification delivery must never change the generic login response.
          }
        }
      }
      await progressiveDelay(state.failures);
      return json({ error: GENERIC_LOGIN_ERROR }, 401);
    }

    await clearFailures(redis, keys);
    return json({ session: safeSession(data.session) });
  } catch {
    return json({ error: "Authentication is temporarily unavailable" }, 503);
  }
}
