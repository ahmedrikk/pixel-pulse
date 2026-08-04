import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  TALUS_EDITORIAL_STYLE_VERSION,
  generateGeminiJson,
  talusSystemPrompt,
} from "../_shared/talus-ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

interface PatchJob {
  patch_id: string;
  game_id: string;
  game_name: string;
  source_title: string;
  source_content: string;
  source_url: string;
  patch_type: string;
  version_label: string | null;
  published_at: string;
}

interface EditorialSection {
  heading: string;
  body: string;
}

interface EditorialCallout {
  label: string;
  body: string;
}

interface EditorialPatch {
  id: string;
  headline: string;
  summary: string;
  opening: string;
  sections: EditorialSection[];
  callouts: EditorialCallout[];
  takeaway: string;
  metaTitle: string;
  metaDescription: string;
}

function parseBatch(payload: string): EditorialPatch[] {
  const parsed = JSON.parse(payload) as unknown;
  if (Array.isArray(parsed)) return parsed as EditorialPatch[];
  if (!parsed || typeof parsed !== "object") throw new Error("Patch editorial JSON is invalid");
  const record = parsed as Record<string, unknown>;
  if (Array.isArray(record.patches)) return record.patches as EditorialPatch[];
  if (record.patches && typeof record.patches === "object") {
    return Object.values(record.patches as Record<string, unknown>) as EditorialPatch[];
  }
  if (typeof record.id === "string") return [record as unknown as EditorialPatch];
  throw new Error(`Patch editorial JSON is invalid (${Object.keys(record).join(", ") || "no keys"})`);
}

async function generateBatchWithFormatRetry(
  systemInstruction: string,
  userPrompt: string,
): Promise<EditorialPatch[]> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const retryInstruction = attempt === 0
        ? ""
        : "\n\nFORMAT REPAIR: The previous response was not parseable JSON. Return one complete JSON object only, with a patches array and no trailing text.";
      return parseBatch(await generateGeminiJson(
        systemInstruction,
        `${userPrompt}${retryInstruction}`,
        { maxOutputTokens: 8_000, timeoutMs: 90_000, service: "game-patch-editorial", operation: attempt === 0 ? "rewrite-batch" : "format-repair" },
      ));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Patch editorial JSON could not be parsed");
}

function assertString(value: unknown, label: string, min: number, max: number): asserts value is string {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) {
    throw new Error(`${label} must contain ${min}-${max} characters`);
  }
}

function validatePatch(value: EditorialPatch, job: PatchJob): EditorialPatch {
  if (value?.id !== job.patch_id) throw new Error(`Editorial response omitted patch ${job.patch_id}`);
  assertString(value.headline, "headline", 20, 180);
  assertString(value.summary, "summary", 70, 420);
  assertString(value.opening, "opening", 80, 1200);
  assertString(value.takeaway, "takeaway", 80, 1200);
  assertString(value.metaTitle, "metaTitle", 20, 75);
  assertString(value.metaDescription, "metaDescription", 80, 180);
  if (!Array.isArray(value.sections) || value.sections.length < 2 || value.sections.length > 7) {
    throw new Error("Each patch needs 2-7 editorial sections");
  }
  value.sections.forEach((section, index) => {
    assertString(section?.heading, `section ${index + 1} heading`, 8, 120);
    assertString(section?.body, `section ${index + 1} body`, 100, 2400);
  });
  if (!Array.isArray(value.callouts) || value.callouts.length < 1 || value.callouts.length > 3) {
    throw new Error("Each patch needs 1-3 practical callouts");
  }
  value.callouts.forEach((callout, index) => {
    assertString(callout?.label, `callout ${index + 1} label`, 3, 60);
    assertString(callout?.body, `callout ${index + 1} body`, 35, 420);
  });
  return {
    ...value,
    headline: value.headline.trim(),
    summary: value.summary.trim(),
    opening: value.opening.trim(),
    takeaway: value.takeaway.trim(),
    metaTitle: value.metaTitle.trim(),
    metaDescription: value.metaDescription.trim(),
    sections: value.sections.map((section) => ({ heading: section.heading.trim(), body: section.body.trim() })),
    callouts: value.callouts.map((callout) => ({ label: callout.label.trim(), body: callout.body.trim() })),
  };
}

function normaliseSentence(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9%.-]+/g, " ").replace(/\s+/g, " ").trim();
}

function hasCopiedSentence(editorial: EditorialPatch, source: string): boolean {
  const sourceSentences = source
    .split(/(?<=[.!?])\s+/)
    .map(normaliseSentence)
    .filter((sentence) => sentence.split(" ").length >= 10);
  const output = normaliseSentence([
    editorial.summary,
    editorial.opening,
    ...editorial.sections.map((section) => section.body),
    ...editorial.callouts.map((callout) => callout.body),
    editorial.takeaway,
  ].join(" "));
  return sourceSentences.some((sentence) => output.includes(sentence));
}

function publicContent(value: EditorialPatch) {
  return {
    opening: value.opening,
    sections: value.sections,
    callouts: value.callouts,
    takeaway: value.takeaway,
  };
}

function plainText(value: EditorialPatch): string {
  return [
    value.opening,
    ...value.sections.flatMap((section) => [section.heading, section.body]),
    ...value.callouts.flatMap((callout) => [callout.label, callout.body]),
    "Why it matters",
    value.takeaway,
  ].join("\n\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders });
  }

  const claimedIds: string[] = [];
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase environment is incomplete");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({})) as { limit?: number };
    const limit = Math.max(1, Math.min(Math.floor(body.limit ?? 3), 5));
    const { data, error } = await supabase.rpc("claim_patch_editorial_jobs", { limit_count: limit });
    if (error) throw error;
    const jobs = (data ?? []) as PatchJob[];
    claimedIds.push(...jobs.map((job) => job.patch_id));
    if (jobs.length === 0) {
      return new Response(JSON.stringify({ ok: true, attempted: 0, completed: 0 }), { headers: jsonHeaders });
    }

    const facts = jobs.map((job) => ({
      id: job.patch_id,
      game: job.game_name,
      sourceTitle: job.source_title,
      patchType: job.patch_type,
      version: job.version_label,
      publishedAt: job.published_at,
      sourceNotes: job.source_content.slice(0, 18_000),
    }));

    const draftRules = talusSystemPrompt(`Rewrite official game patch notes into original, useful Talus patch articles.
- Return one JSON object with a patches array. Produce exactly one object per supplied patch and preserve each id.
- Each object must contain: id, headline, summary, opening, sections, callouts, takeaway, metaTitle, metaDescription.
- sections must contain 2-7 objects with heading and body. Group changes by player impact, not the source's order.
- callouts must contain 1-3 objects with a short label and practical body explaining what players should do.
- summary is a 2-3 sentence teaser for the archive tile. The other fields form the full article.
- Write entirely original prose. Never copy a source sentence, its headings, flavor text, or list structure.
- Specific supplied names and numeric before/after values may be stated plainly. Do not add facts or infer an unsupplied change.
- Headline and metadata must name the game and identify the patch plainly for search.
- The takeaway should give a measured, grounded read of the patch's overall effect, not generic praise.
- Do not mention this rewrite process, AI, or source-data limitations.`);

    const draft = await generateBatchWithFormatRetry(
      draftRules,
      `SOURCE PATCHES\n${JSON.stringify(facts)}\n\nWrite the first editorial drafts.`,
    );

    const editRules = talusSystemPrompt(`Apply a final voice-and-rhythm edit to Talus patch articles.
- Return one JSON object with a patches array, exactly preserving every object, id, field, section, and callout.
- Keep every factual claim grounded in SOURCE PATCHES. Delete unsupported interpretation rather than softening it.
- Restructure any wording or sequence that resembles the official notes. No developer sentence or heading may survive verbatim.
- Vary sentence and paragraph rhythm. Remove formulaic transitions, repetition, hype, hedging, and list-like prose.
- Keep concrete numbers, names, and version labels accurate.
- Preserve a scannable player-first shape: framing, descriptive sections, practical callouts, and a clear takeaway.
- metaTitle must be 20-75 characters; metaDescription must be 80-180 characters.`);

    const edited = await generateBatchWithFormatRetry(
      editRules,
      `SOURCE PATCHES\n${JSON.stringify(facts)}\n\nDRAFTS TO EDIT\n${JSON.stringify({ patches: draft })}`,
    );

    const byId = new Map(edited.map((item) => [item.id, item]));
    const completed: string[] = [];
    const failures: Array<{ patchId: string; error: string }> = [];
    for (const job of jobs) {
      try {
        const item = validatePatch(byId.get(job.patch_id) as EditorialPatch, job);
        if (hasCopiedSentence(item, job.source_content)) {
          throw new Error("The edited article retained a source sentence");
        }
        const { error: updateError } = await supabase
          .from("game_patches")
          .update({
            title: item.headline,
            summary: item.summary,
            content_text: plainText(item),
            editorial_content: publicContent(item),
            meta_title: item.metaTitle,
            meta_description: item.metaDescription,
            editorial_status: "ready",
            editorial_style_version: TALUS_EDITORIAL_STYLE_VERSION,
            editorial_generated_at: new Date().toISOString(),
            editorial_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.patch_id);
        if (updateError) throw updateError;
        completed.push(job.patch_id);
      } catch (itemError) {
        const message = itemError instanceof Error ? itemError.message : String(itemError);
        failures.push({ patchId: job.patch_id, error: message });
        await supabase
          .from("game_patches")
          .update({
            editorial_status: "failed",
            editorial_error: message.slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.patch_id);
      }
    }

    return new Response(JSON.stringify({
      ok: failures.length === 0,
      attempted: jobs.length,
      completed: completed.length,
      patchIds: completed,
      failures,
    }), {
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error("Patch editorial rewrite failed", error);
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceRoleKey && claimedIds.length > 0) {
        await createClient(supabaseUrl, serviceRoleKey)
          .from("game_patches")
          .update({
            editorial_status: "failed",
            editorial_error: (error instanceof Error ? error.message : String(error)).slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .in("id", claimedIds);
      }
    } catch {
      // Preserve the original failure response; queue bookkeeping is best effort.
    }
    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
