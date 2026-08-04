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

interface GameFacts {
  name?: string;
  developer?: string;
  publisher?: string;
  releaseDate?: string;
  genres?: string[];
  platforms?: string[];
  sourceSummary?: string;
}

function parseDescription(payload: string): string {
  const parsed = JSON.parse(payload) as { description?: unknown };
  if (typeof parsed.description !== "string") throw new Error("Description JSON is invalid");
  return parsed.description.trim();
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders });
  }

  let requestedGameId: string | undefined;
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase environment is incomplete");

    const body = await req.json() as { gameId?: string; facts?: GameFacts };
    const gameId = body.gameId?.trim();
    if (!gameId) throw new Error("gameId is required");
    requestedGameId = gameId;

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("id, name, description, description_status, developer, publisher, release_date, genres, platforms")
      .eq("id", gameId)
      .maybeSingle();
    if (gameError) throw gameError;
    if (!game) return new Response(JSON.stringify({ error: "Game not found" }), { status: 404, headers: jsonHeaders });

    if (game.description_status === "ready" && wordCount(game.description ?? "") >= 220) {
      return new Response(JSON.stringify({ ok: true, cached: true, description: game.description }), { headers: jsonHeaders });
    }

    await supabase
      .from("games")
      .update({ description_status: "generating", updated_at: new Date().toISOString() })
      .eq("id", gameId);

    const supplied = body.facts ?? {};
    const facts = {
      name: game.name || supplied.name || gameId,
      developer: supplied.developer || game.developer || null,
      publisher: supplied.publisher || game.publisher || null,
      releaseDate: supplied.releaseDate || game.release_date || null,
      genres: supplied.genres?.length ? supplied.genres : game.genres ?? [],
      platforms: supplied.platforms?.length ? supplied.platforms : game.platforms ?? [],
      sourceSummary: (supplied.sourceSummary || (game.description_status !== "ready" ? game.description : "") || "").slice(0, 7000),
    };

    const draftPrompt = talusSystemPrompt(`Write an original game overview from supplied facts.
- Return JSON with exactly one key: description.
- Target 270-330 words in 4-6 natural paragraphs, with no heading or bullet list.
- Explain what playing the game feels like, its identity, and who may enjoy it.
- Use varied sentence length, concrete detail, and a measured point of view.
- Do not copy phrases from SOURCE SUMMARY. Treat it only as factual notes.
- Do not invent facts that are absent from the supplied material.
- Avoid formulaic openings, generic praise, sales language, and review-score claims.`);

    const draft = parseDescription(await generateGeminiJson(
      draftPrompt,
      `FACTS\n${JSON.stringify(facts)}\n\nWrite the first draft.`,
      { maxOutputTokens: 1300, service: "game-description-backfill", operation: "draft" },
    ));

    const editPrompt = talusSystemPrompt(`Edit a game overview for a recognizably human editorial voice.
- Return JSON with exactly one key: description.
- Keep every factual claim grounded in FACTS and preserve no unsupported statement.
- Target 260-340 words in 4-6 paragraphs, with no heading or bullet list.
- Vary rhythm and paragraph shape. Remove stock transitions, hedging, repetition, and list-like sentences.
- Keep useful specificity and a real point of view without turning the piece into marketing copy.
- Rephrase any wording that appears borrowed from SOURCE SUMMARY.`);

    let finalDescription = parseDescription(await generateGeminiJson(
      editPrompt,
      `FACTS\n${JSON.stringify(facts)}\n\nDRAFT TO EDIT\n${draft}`,
      { maxOutputTokens: 1300, service: "game-description-backfill", operation: "edit" },
    ));

    let finalWordCount = wordCount(finalDescription);
    for (let repairAttempt = 0; repairAttempt < 2 && (finalWordCount < 240 || finalWordCount > 360); repairAttempt += 1) {
      finalDescription = parseDescription(await generateGeminiJson(
        editPrompt,
        `FACTS\n${JSON.stringify(facts)}\n\nCURRENT EDIT (${finalWordCount} words)\n${finalDescription}\n\nRepair the length to 270-330 words. Count the words before returning JSON. Preserve grounded detail and natural paragraphs; do not pad with generic filler.`,
        { maxOutputTokens: 1400, service: "game-description-backfill", operation: "length-repair" },
      ));
      finalWordCount = wordCount(finalDescription);
    }

    if (finalWordCount < 220 || finalWordCount > 380) {
      throw new Error(`Generated description has ${finalWordCount} words`);
    }

    const { error: updateError } = await supabase
      .from("games")
      .update({
        description: finalDescription,
        description_status: "ready",
        description_generated_at: new Date().toISOString(),
        description_style_version: TALUS_EDITORIAL_STYLE_VERSION,
        updated_at: new Date().toISOString(),
      })
      .eq("id", gameId);
    if (updateError) throw updateError;

    return new Response(JSON.stringify({ ok: true, cached: false, wordCount: finalWordCount, description: finalDescription }), { headers: jsonHeaders });
  } catch (error) {
    console.error("Game description enrichment failed", error);
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceRoleKey && requestedGameId) {
          await createClient(supabaseUrl, serviceRoleKey)
            .from("games")
            .update({ description_status: "failed", updated_at: new Date().toISOString() })
            .eq("id", requestedGameId);
      }
    } catch {
      // The primary error is returned below; status bookkeeping is best-effort.
    }
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
