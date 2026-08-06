# Talus API, quota, and cost audit

Date: August 4, 2026  
Scope: production Supabase workers, scheduled jobs, client-side integrations, and the game-description backfill.

## Follow-up verification — August 6, 2026

- The live `news_updates` control remains disabled. The newest `cached_articles.fetched_at` value is **August 4, 2026 at 5:02 PM CDT**, 27 minutes before the original pause. No new homepage news rows were inserted after the pause.
- The site could still look as though news was updating because `get_ranked_feed` recalculated order every 15 minutes and adjusted results after impressions. Freeze mode now bypasses that ranking behavior and returns a deterministic newest-first feed.
- A database trigger now cancels every insert, update, or delete on `cached_articles` while the pause is active. This protects against renamed cron jobs, external workers, old browser clients, and direct service-role writers.
- Cron cleanup now matches both job names and Edge Function destination URLs, so renamed copies are also archived and unscheduled.
- The remaining API traffic was backend work, not news ingestion. From ledger activation through the August 6 check, Gemini recorded **1,168 calls**, approximately **779,878 input tokens** and **294,920 output tokens**. At the published paid-tier `gemini-3.5-flash-lite` rates, that token volume is roughly **$0.97**; the provider dashboard remains authoritative for actual billing and free-tier treatment.
- The game-description run had processed 280 of 542 records: 184 succeeded and 96 failed, with 262 not yet processed. Those calls intentionally remain active because the owner requested backend completion while news is paused.

## Executive summary

- News updates were paused at `2026-08-04 17:29:40 America/Chicago`.
- Five schedules were archived and removed: the 30-minute gaming-news fetch, five-minute cache-floor guard, five-minute news warm-up, hourly esports-news fetch, and hourly trending computation.
- The three callable news entry points also have a database-backed kill switch. Direct calls now return `paused: true` before contacting RSS, YouTube, AI, Steam, Twitch, RAWG, or PandaScore.
- Existing cached news remains readable. Nothing was deleted.
- The game-description backfill, trivia pool, game patches, free-games collector, and other backend jobs remain enabled.
- The historical database did not store provider token usage. A durable `api_usage_events` ledger now records Gemini request outcomes, model, workflow, token counts, cache tokens, latency, and status without storing prompts, responses, or credentials.
- Kimi is not configured in the current Supabase production secrets and is not being called by the current backend.
- YouTube Data API use today was zero quota units. All 15 configured YouTube sources used the official Atom-feed fallback.

## Observed production activity before the pause

The pause-time database snapshot recorded:

| Signal | Observed value |
|---|---:|
| Articles fetched during the preceding 24 hours | 192 |
| Articles fetched during the preceding 7 days | 1,522 |
| YouTube Data API quota units on August 4 | 0 |
| Configured active YouTube sources | 15 |
| Backfill target | 542 games |
| Backfill finalized at audit time | 66 |
| Backfill successes at audit time | 65 |
| Backfill permanent failures at audit time | 1 |

The moving 24-hour source query shortly after the pause contained 187 items: 155 articles and 32 YouTube cards. The largest contributors were Destructoid and Polygon (17 each), followed by Eurogamer, PC Gamer, and Nintendo Life (12 each). The difference from the 192-item pause snapshot is caused by the rolling 24-hour boundary.

## News schedules now paused

| Job | Previous schedule | Normal work avoided |
|---|---|---|
| `fetch-gaming-news` | Every 30 minutes | 20 RSS feeds, eligible YouTube feeds, article scraping, and AI summaries/tags |
| `guard-news-cache-floor` | Every 5 minutes | Database cache check; could invoke the full news pipeline when fewer than 10 articles remained |
| `warm-fetch-news-function` | Every 5 minutes | Edge Function health invocation |
| `fetch-esports-news` | Hourly | Five esports RSS feeds and database upserts |
| `compute-trending-hourly` | Hourly | Steam, Twitch, RAWG, and PandaScore calls plus score recomputation |

Before the pause, the guaranteed schedule represented 384 Edge Function invocations per day: 48 full news calls, 288 warm-ups, 24 esports calls, and 24 trending calls. The cache-floor guard could add up to another 288 full news invocations per day in a cache failure scenario.

A full news run could make 20 RSS requests, poll eligible YouTube feeds, scrape up to 30 article pages through Jina Reader, and AI-process up to 20 candidates. At the former 30-minute cadence, the theoretical ceiling was 960 RSS requests, 1,440 article-scrape attempts, and 960 AI-processed candidates per day before deduplication and source polling rules reduced the real totals.

## Backend schedules deliberately left running

| Job | Schedule | External dependency |
|---|---|---|
| `backfill-game-descriptions` | Every 5 minutes, 3 games per batch | Gemini; normally two generation calls per successful game, plus length repairs when needed |
| `ensure-daily-trivia-pool` | Hourly, only when fewer than 5 active questions exist | Gemini first, Groq fallback |
| `fetch-game-patches` | Hourly | Steam News API |
| `rewrite-game-patches` | Hourly, up to 3 patches | Gemini |
| `fetch-free-games` | Twice hourly | GamerPower and Epic Games public endpoints |
| `cleanup-feed-ranking-history` | Daily | Database only; no external provider |

## Provider inventory and current limits

### Google Gemini

- Configured and actively used for game descriptions, patch editorial, trivia primary generation, and article processing when news is enabled.
- Production model configuration is `gemini-3.5-flash-lite`.
- Official paid pricing is **$0.30 per 1M input tokens** and **$2.50 per 1M output tokens**; the listed free tier is free of charge within its rate limits. [Official Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Historical token counts were unavailable. Exact token and failure accounting begins with this audit through `api_usage_events`.
- The first instrumented sample confirmed the backend blocker: Gemini returned HTTP **429 — current quota exceeded**. The ledger captured five game-description requests (four draft calls and one edit call): one draft succeeded, three drafts failed, and the edit failed. It also captured two failed patch-editorial calls. The successful draft used 507 input tokens and 253 output tokens (760 total), but its following edit could not complete because quota was exhausted.
- At the published paid rates, those 507 input and 253 output tokens would equal approximately **$0.000785**. Whether that request was actually billed depends on the Google project tier and credits; the provider billing dashboard is authoritative.
- Cost formula: `(input tokens / 1,000,000 × $0.30) + (output tokens / 1,000,000 × $2.50)`.

### Groq

- Configured as fallback for trivia and article/news processing.
- Current code names `llama-3.3-70b-versatile` and `llama-3.1-8b-instant`.
- Llama 3.3 70B is listed at **$0.59 per 1M input tokens** and **$0.79 per 1M output tokens**. [Official Groq models and pricing](https://console.groq.com/docs/models)
- The published free-plan limits for Llama 3.3 70B are 30 RPM, 1,000 requests/day, 12,000 tokens/minute, and 100,000 tokens/day. [Official Groq rate limits](https://console.groq.com/docs/rate-limits)
- Important: both configured Llama model IDs are scheduled for shutdown on **August 16, 2026** for free/developer usage. Groq recommends `openai/gpt-oss-20b`, `openai/gpt-oss-120b`, or `qwen/qwen3.6-27b`. [Official Groq deprecation notice](https://console.groq.com/docs/deprecations)

### Kimi and OpenRouter

- Kimi is not configured in the current Supabase secrets and no production function calls a Kimi/Moonshot endpoint.
- An OpenRouter secret exists, but no current production Edge Function references it. It is configured but idle.
- Therefore the current backend backfill is not responsible for new Kimi spending.

### YouTube

- No `YOUTUBE_API_KEY` is configured in Supabase.
- The ingestion worker therefore uses official channel Atom feeds, which consume **zero YouTube Data API quota units**.
- If the Data API is enabled later, `playlistItems.list` costs one quota unit per call. Google lists a default allocation of 10,000 units/day for the general endpoint pool. [Official quota calculator](https://developers.google.com/youtube/v3/determine_quota_cost) and [playlistItems.list documentation](https://developers.google.com/youtube/v3/docs/playlistItems/list)

### RAWG

- Configured in both the server and browser build.
- Used for game catalog/search/detail enrichment and, when enabled, trending enrichment.
- RAWG lists a free non-commercial/hobby tier of up to 20,000 requests/month and a $149/month business tier with up to 50,000 requests/month. [Official RAWG API plans](https://rawg.io/apidocs)
- Actual historical request totals are not stored. Browser-side calls make exact server-side accounting impossible until RAWG access is proxied through Talus.

### Steam

- Configured in both the server and browser build.
- Used for profiles, owned games, current player counts, game identification, and patch/news collection.
- Valve makes the Steam Web API available free and limits keys to 100,000 calls/day. [Official Steam Web API terms](https://steamcommunity.com/dev/apiterms)
- Actual historical request totals are not stored because several calls originate directly from users' browsers.

### PandaScore

- Configured server-side and used by esports pages and the paused trending computation.
- PandaScore documents a 1,000-request/hour REST limit for its schedules/results/context plan; the account dashboard and response headers are authoritative for the actual plan and remaining balance. [Official PandaScore rate limits](https://developers.pandascore.co/docs/rate-and-connections-limits)
- The code does not currently persist `X-Rate-Limit-Remaining`, so historical quota use cannot be reconstructed precisely.

### Twitch

- Configured for trending computation, which is now paused.
- Twitch uses a token-bucket system. Each normal endpoint defaults to one point, and every response includes `Ratelimit-Limit`, `Ratelimit-Remaining`, and `Ratelimit-Reset`. [Official Twitch API rate-limit guide](https://dev.twitch.tv/docs/api/guide)
- Those headers are not currently persisted.

### Supabase Edge Functions

- Supabase counts an invocation even when it returns an error; OPTIONS preflight calls are excluded.
- Free projects include 500,000 invocations. Pro includes 2 million, with overage billed at $2 per additional 1 million invocations. [Official Supabase invocation usage](https://supabase.com/docs/guides/platform/manage-your-usage/edge-function-invocations)
- Removing the five news schedules eliminates at least 384 predictable invocations/day, roughly 11,520 per 30-day month, before counting avoided cache-floor emergency calls.

## Security and quota-control findings

1. **Steam key exposure — high priority.** `VITE_STEAM_API_KEY` is referenced by browser code. Every `VITE_` value used by the application is shipped to visitors. Move Steam profile and owned-game calls behind a server function, rotate the Steam key, then remove the Vite secret.
2. **RAWG quota exposure — medium priority.** `VITE_RAWG_API_KEY` is intentionally used client-side, so third parties can consume its monthly allowance. Proxy and cache RAWG calls before production if predictable quota enforcement matters.
3. **Groq model expiry — high priority.** The fallback models reach their published shutdown date on August 16, 2026. Replace them before re-enabling news.
4. **Historical accounting gap.** AI token use, PandaScore remaining requests, Twitch bucket state, RAWG calls, and Steam calls were not previously persisted. Gemini accounting is now live; other providers should be routed through server-side wrappers and logged before production.
5. **Excess news warm-up cadence — resolved while paused.** The five-minute warm-up alone generated 288 Edge invocations/day without fetching content. It should not be restored unchanged.
6. **Backend backfill is quota-blocked — immediate.** The scheduler is healthy, but Gemini is returning 429 quota-exceeded responses. The remaining descriptions cannot complete until the Gemini quota resets, billing/quota is increased, or a controlled fallback provider is approved. A quota circuit breaker now preserves queued jobs and waits one hour after the latest 429 before probing again, instead of consuming every game's retry allowance every five minutes.

## Recommended restart policy

Do not restore the archived schedules as-is. When backend completion is stable:

1. Keep the function-level `news_updates` kill switch.
2. Restore the main news collector at once every 2–4 hours, not every 30 minutes.
3. Remove the five-minute warm-up permanently.
4. Keep one cache-floor guard at 30–60 minute cadence.
5. Poll YouTube through Atom feeds unless a feature genuinely requires the Data API.
6. Replace deprecated Groq models before any news restart.
7. Proxy Steam and RAWG browser calls through Talus, add caching, and write usage events.
8. Add budget alarms in the Gemini, Groq, Supabase, RAWG, and PandaScore dashboards; application logs cannot see account-level billing credits or balances.

## What the new ledger can answer

The database function below returns provider/model/workflow request counts and token totals without exposing prompts or credentials:

```sql
select * from public.get_api_usage_summary(now() - interval '24 hours');
```

This report should be refreshed after the backfill has run with instrumentation for at least one hour. Provider billing dashboards remain the source of truth for account balance, credits, taxes, and plan-specific quota overrides.
