# QA Report — Full Site Test Pass

**Date:** 2026-07-07
**Tester:** Claude (Claude Code session), driving the production site in Chrome
**Environment:** https://pixel-pulse-roan.vercel.app (production, commit `08eedf3` at test time)
**Method:** Guest walkthrough of every route + interaction testing + code verification of each finding. Authenticated flows could NOT be tested (no test account; demo mode is dead — see F2). **Someone should repeat the review/predict/trivia/profile flows with a real logged-in account.**

## Route coverage

| Route | Status |
|---|---|
| `/` (news feed) | ✅ Loads, live articles, tag filter works, Smart Feed renders |
| `/reviews` (catalog + trending) | ✅ Trending row shows real signals (Steam counts, news, ranks); search works |
| `/reviews/:gameId` | ✅ Renders; ❌ review submit broken for guests (F1, fixed) |
| `/login` | ✅ Redirects to `/` + opens auth modal |
| `/esports` | ✅ Live/upcoming matches, filters; predictions gate correctly |
| `/trivia` | ❌ Broken empty state for guests (F3, fixed) |
| `/leaderboard` | ⚠️ Renders, but data is hardcoded mock users (F8, open) |
| `/battle-pass` | ⚠️ Renders; copy bugs + expired season dates (F4/F5, fixed) |
| `/hub` | ✅ Trivia + hype meter render; ⚠️ hype data is hardcoded (F9, open) |
| `/profile` (guest) | ✅ Correctly gates behind auth modal |
| `/u/:username` (unknown) | ✅ Clean "User not found" page |
| `/guides`, `/hardware`, `/notifications` | ✅ Coming Soon pages |
| Unknown route | ✅ 404 page (⚠️ unstyled/bare vs rest of app — F12, open) |
| `/terms`, `/privacy`, `/cookies`, `/guidelines` | Not deeply tested (footer links present) |

## Findings

### Fixed in this pass (commit follows this report)

**F1 — Submit Review does nothing for guests** `src/pages/GameReview.tsx`
Guests could fill in stars + text and click Submit with zero feedback: the mutation threw "Not authenticated" and the catch block swallowed it (comment claimed "Auth gate will handle" — it didn't). Real errors (RLS etc.) were also swallowed silently.
*Fix:* unauthenticated submit now opens the auth modal (`openAuthModal("review")` — same pattern as Like); real failures show an error toast; success shows a confirmation toast.

**F2 — Demo mode is dead code** `src/integrations/supabase/client.ts`
`enableDemoMode()` / `isDemoMode()` / `MOCK_USER` / `DEMO_PROFILE` exist, but setting the flag does nothing: `AuthGateContext` treats demo mode as "no Supabase config → run as guest". No UI exposes it either.
*Status:* **left as-is (decision needed)** — either delete the dead code or rebuild a working demo path. Recommend deleting to avoid confusion.

**F3 — /trivia renders broken UI when no questions** `src/pages/DailyTrivia.tsx`
For guests (or when trivia isn't seeded), the page showed "Question 1 of 0" and a ghost results card: "/3 Correct!" with empty score and "+ XP" with no number.
*Fix:* added an explicit empty state ("No trivia right now" + sign-in hint + back button).

**F4 — "the The Ember" copy bug on Battle Pass** `public/mock/season.json`
Templates render "Why join the {shortName}?" with `shortName: "The Ember"` → "Why join the The Ember?" (also "let the The Ember burn").
*Fix:* `shortName` → `"Ember"`. All templates now read naturally.

**F5 — Season dates expired** `public/mock/season.json`
`endDate` was 2026-06-30 (a week in the past): hero showed "Ends in 0d 0h 0m" and "Season ends June 30" while everything else says "Season 1 live".
*Fix:* season window moved to Jul 1 – Sep 30, 2026. **Note:** this is mock data; see F10.

**F6 — Auth modal doesn't close on Escape** `src/components/AuthGatePopup.tsx`
*Fix:* added a keydown listener while the modal is open.

**F7 — Trending scores polluted by name-substring matching** `supabase/functions/compute-trending/index.ts`
The 1996 "Diablo" was #2 trending with Diablo IV's news buzz AND Diablo IV's Steam player count (substring matching in both news-tag matching and Steam store-search acceptance). "Forza Horizon 6" similarly claimed 22K Steam players. Reviews upsert also wrote `name: gameId` (slug as display name), polluting the games cache.
*Fix:* all name comparisons now use a canonical form (normalize + trailing roman→arabic numerals + alias map for gta6/cs2/etc.) and require **exact** matches; unmatched sequels get their own games-cache entry via RAWG discovery instead of feeding the base game. Review upsert now stores the real display name.
*Deployed:* edge function v7. Stale wrong `steam_appid`s in the games table were reset so they re-resolve correctly.

**F8 — Leaderboard is hardcoded mock users** ✅ FIXED (2026-07-07, second pass)
Season / Weekly / Predictions tabs now read real data via SECURITY DEFINER RPCs (`get_season_leaderboard`, `get_weekly_leaderboard` from `xp_events`, `get_prediction_leaderboard` from `predictions`) — see migration `20260707130000_leaderboard_and_hype.sql`. Mock users removed; proper empty states + loading skeletons added. "Your Rank" card now shows the user's real position instead of hardcoded rank 42.

**F9 — Hub Hype Meter is hardcoded mock** ✅ FIXED (2026-07-07, second pass)
New `hype_votes` table (one vote per user per game, RLS: own rows only; public aggregate via `get_hype_leaderboard` RPC). `useHypeMeter` now persists votes to Supabase, search uses the real RAWG API, and vote counts / percentages / weekly trends are computed from real votes. A curated seed list of upcoming titles (GTA 6, Elder Scrolls VI, Witcher 4…) keeps the meter populated at zero votes — no fake counts anymore.

**Battle Pass disabled → Coming Soon** (requested 2026-07-07, second pass)
`/battle-pass` now renders the ComingSoon page (swords icon, "Battle Pass Coming Soon"). The `BattlePass` page component is orphaned but left in the repo for when the season system ships. Sidebar promo widget relabelled from "Live" to "Coming soon" with launch-teaser copy. This also moots F4/F5 on the public page (season.json copy fixes remain for the promo widget + future relaunch).

### Open — needs product decisions or bigger work (for Kimi)

**F10 — `/api/seasons/current` doesn't exist** `src/lib/api.ts`
`getCurrentSeason()` fetches `/api/seasons/current`; the SPA rewrite returns index.html, `res.json()` throws, and the mock (`public/mock/season.json`) is silently used every time. Either build the endpoint (seasons table) or drop the fetch and import the config directly — current code fires a doomed network request + console warning on every battle-pass visit.

**F10.5 — More news sources** ✅ DONE (2026-07-07, third pass)
Added 8 RSS feeds to `fetch-news` (Eurogamer, Rock Paper Shotgun, Destructoid, Siliconera, Nintendo Life, Push Square, Dot Esports, GamesIndustry.biz) — 12 → 20 sources. Purely additive: same parser, same gaming filter, same article template; `PROCESS_LIMIT = 20` per run means the backlog drains over the 30-min cron cycles. Feed fetching switched from sequential to parallel (per-feed 10s timeout unchanged) so wall-clock time stays ~10s regardless of feed count.
**Scrapling:** stealth mode drives a real headless Firefox (Camoufox) — it cannot run inside Supabase Edge Functions (Deno) or Vercel serverless. For no-RSS/anti-bot sites, use `tools/scrapling_news_worker.py`: a standalone Python worker (run on a PC/VPS/GitHub Actions cron with `SUPABASE_SERVICE_KEY`) that writes the exact same `cached_articles` shape, so the frontend template is untouched. Sources list is empty by design — add selectors per site and keep it polite.

**F11 — Brand identity** ✅ FIXED (2026-07-07, third pass)
Standardized on **PixelPulse** (matches repo, domain, legal pages, bot UA). Swept LevelUpXP + Game Pulse from the navbar logo, index.html meta/OG/Twitter tags, 404.html, share text, story-card canvas wordmark, onboarding panels, and loading states; "Pixel Pulse" prose unified to "PixelPulse". All-caps wordmarks render as "PIXEL PULSE". **Deliberately NOT renamed:** the `gamepulse_bookmarks` localStorage key (renaming would wipe existing users' bookmarks) and "LEVEL UP!" strings (game mechanic, not brand).

**F12 — 404 page** ✅ FIXED (2026-07-07, third pass)
`NotFound.tsx` now uses `SiteLayout` with the brand gradient, gamepad icon, and two styled CTAs (feed + trending games).

**F13 — Guest trivia widget** ✅ FIXED (2026-07-07, third pass)
The widget did call `openAuthModal("trivia_answer" as never)`, but `trivia_answer` wasn't a real `GatedAction` and had no headline copy. Now first-class: added `trivia_answer` and `hub_hype` to the `GatedAction` union with dedicated popup headlines, removed both `as never` casts. (Original QA repro may have been a missed click — retest gating with a fresh guest session.)

**F14 — Intermittent renderer freezes** ⚠️ MITIGATED, still open
Static analysis found no infinite animations or heavy intervals on the affected pages. Most plausible contributor: staggered framer-motion delays scaling with item count (40 search results × 0.05s = 2s+ of rolling transform animations after every search change). Capped stagger at 0.4s on GameCard/TrendingCard. **Still worth profiling** with React DevTools Profiler / Chrome Performance tab on `/reviews` and `/reviews/:id` during search + submit interactions — the freeze was never reproducible on demand.

**F15 — Authenticated flows untested → code-reviewed, bugs fixed (2026-07-08)**
A code review of the authenticated flows (by Kimi) surfaced four issues; all fixed:

- **F15.1 — Pending actions lost after login** ✅ FIXED. `executePendingAction` only cleared state; a guest's review draft vanished after sign-in. The draft (stars + text) now rides in the pending action's `data` payload; `GameReview` restores it into the form after auth and toasts "draft restored". Combined with the F15.4 fix, OAuth users land back on the same game page with their draft intact. *Caveat:* the pending action only replays for users whose onboarding is complete (existing AuthGateContext behavior) — brand-new signups go through onboarding first and keep the draft in sessionStorage until their next sign-in event.
- **F15.2 — Prediction duplicates** ✅ FIXED (diagnosis corrected). Duplicates were never possible: `predictions_user_id_match_id_key` already enforces one per match. The REAL bug found while verifying: **predictions has RLS enabled with only a SELECT policy — every insert was silently rejected; no prediction has ever saved.** Migration `20260707150000` adds the missing INSERT policy; `submitPrediction` now also checks for an existing pick (no double XP) and handles unique-violation races.
- **F15.3 — `ignoreDuplicates` on games upsert** ✅ FIXED. Removed, so placeholder names get corrected on later submissions (the games table has an authenticated UPDATE policy, verified live).
- **F15.4 — OAuth dumps users on homepage** ✅ FIXED. `redirectTo` now uses the current path + query (the Supabase redirect allow-list already includes `<origin>/**`, verified via Management API).

Minor items from the same review:
- **Helpful vote never persisted** ✅ FIXED — `handleVote` only fired XP tracking; it now calls the `increment_helpful_votes` mutation (RPC verified present) and gates guests behind the auth modal.
- **`insertComment` relies on RLS only** ✅ FIXED — added an explicit userId/body guard.
- **7-day popup suppression** — not a bug: the `auth_popup_dismissed_at` suppression only applies to the passive `scroll` trigger; explicit actions (like, review, predict) always show the modal. Left as designed.

Still genuinely untested end-to-end: live posting/prediction/trivia with a real account. The insert-policy fix means predictions should START working — worth one manual pass.

## Verification of today's trending work (context for Kimi)

The multi-signal trending engine (edge function `compute-trending` v6→v7) was verified live on `/reviews`: rank badges, "18K playing on Steam", "In the news" reasons, RAWG-rating fallback all render. Hourly refresh runs via pg_cron job `compute-trending-hourly` (minute 10) — **not** Vercel cron (Hobby plan forbids sub-daily; that's what broke deploys for 8+ hours, fixed in `08eedf3`).
