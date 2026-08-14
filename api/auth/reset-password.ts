import {
  checkRateLimit,
  GENERIC_RESET_MESSAGE,
  getAuthClient,
  getRedis,
  ipKey,
  json,
  readJsonBody,
  rejectNonPost,
  resetBodySchema,
  safeRedirect,
} from "../_shared/auth-security";

export const config = { runtime: "edge" };

export default async function handler(request: Request): Promise<Response> {
  const methodError = rejectNonPost(request);
  if (methodError) return methodError;

  try {
    const parsed = resetBodySchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return json({ message: GENERIC_RESET_MESSAGE });

    const redis = getRedis();
    const allowed = await checkRateLimit(redis, await ipKey(request, "reset"), 5, 15 * 60 * 1000);
    if (allowed) {
      const auth = getAuthClient();
      await auth.auth.resetPasswordForEmail(parsed.data.email, {
        redirectTo: safeRedirect(parsed.data.redirectTo),
      }).catch(() => undefined);
    }
  } catch {
    // Reset requests are intentionally indistinguishable, including provider failures.
  }
  return json({ message: GENERIC_RESET_MESSAGE });
}
