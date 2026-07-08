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

**F11 — Brand identity is three different names**
Header/logo: **LevelUpXP** · Footer/legal: **Pixel Pulse** · Onboarding + feed types: **Game Pulse**. Pick one and sweep (`grep -ri "levelupxp\|game pulse\|pixel pulse" src/`).

**F12 — 404 page is unstyled** `src/pages/NotFound.tsx`
Plain white page, no nav/layout — jarring vs the rest of the app. Wrap in `SiteLayout` with a styled CTA.

**F13 — Guest trivia widget (home right rail) gives no feedback on click**
Clicking an answer option as guest does nothing visible (no selection state, no auth modal). Expected: gate like Like/Predict do. `src/components/shared/TriviaWidget.tsx`.

**F14 — Intermittent renderer freezes (~30s) after interactions**
During testing, the page froze repeatedly right after clicks (screenshot capture timed out; "renderer unresponsive"), mostly on `/reviews/:id`. Suspect a heavy re-render or framer-motion animation loop. Worth profiling with React DevTools / Performance tab. Not reproducible on demand, but it happened 4+ times in one session.

**F15 — Authenticated flows untested**
Review posting, predictions, trivia scoring/XP, profile editing, onboarding, article comments, Google OAuth — all need a pass with a real account. The tester could not create accounts or enter credentials by policy.

## Verification of today's trending work (context for Kimi)

The multi-signal trending engine (edge function `compute-trending` v6→v7) was verified live on `/reviews`: rank badges, "18K playing on Steam", "In the news" reasons, RAWG-rating fallback all render. Hourly refresh runs via pg_cron job `compute-trending-hourly` (minute 10) — **not** Vercel cron (Hobby plan forbids sub-daily; that's what broke deploys for 8+ hours, fixed in `08eedf3`).
