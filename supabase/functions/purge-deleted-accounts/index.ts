import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (request) => {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return new Response("Missing server configuration", { status: 500 });

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || claims.claims?.role !== "service_role") {
    return Response.json({ error: "Server authorization required" }, { status: 403 });
  }
  const { data: expired, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("account_status", "pending_deletion")
    .lte("scheduled_deletion_at", new Date().toISOString())
    .limit(100);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const failures: Array<{ id: string; error: string }> = [];
  for (const account of expired ?? []) {
    const { error: deleteError } = await supabase.auth.admin.deleteUser(account.id);
    if (deleteError) failures.push({ id: account.id, error: deleteError.message });
  }
  return Response.json({ deleted: (expired?.length ?? 0) - failures.length, failures });
});
