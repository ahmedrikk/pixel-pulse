const encoder = new TextEncoder();

function timingSafeEqual(left: string, right: string): boolean {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let mismatch = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    mismatch |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return mismatch === 0;
}

function configuredServerKeys(): string[] {
  const keys = new Set<string>();
  const dedicatedCronKey = Deno.env.get("CRON_API_KEY")?.trim();
  const legacyServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();

  if (dedicatedCronKey) keys.add(dedicatedCronKey);
  if (legacyServiceRoleKey) keys.add(legacyServiceRoleKey);

  const modernSecretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (modernSecretKeys) {
    try {
      const parsed = JSON.parse(modernSecretKeys) as Record<string, unknown>;
      for (const value of Object.values(parsed)) {
        if (typeof value === "string" && value.trim()) keys.add(value.trim());
      }
    } catch {
      console.error("SUPABASE_SECRET_KEYS is not valid JSON");
    }
  }

  return [...keys];
}

export function isTrustedServerRequest(req: Request): boolean {
  const apiKey = req.headers.get("apikey")?.trim();
  const authorization = req.headers.get("authorization")?.trim();
  const bearer = authorization?.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : null;
  const presented = [apiKey, bearer].filter((value): value is string => Boolean(value));

  if (presented.length === 0) return false;
  return configuredServerKeys().some((expected) =>
    presented.some((candidate) => timingSafeEqual(candidate, expected))
  );
}

export function unauthorizedResponse(corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
