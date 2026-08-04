# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## YouTube ingestion

Talus polls configured YouTube upload playlists without using the expensive
YouTube Search API. `GameTrailers`, `Skill Up`, `Digital Foundry`,
`LevelCapGaming`, `videogamedunkey`, `Top5Gaming`, `Mortismal Gaming`, and
`LegacyKillaHD` are joined by `Inside Gaming`, `ClemmyGames`, `IndieHub01`,
`Best Indie Game Trailers`, `GamingBolt`, `SwitchUp`, and `Bellular News`.
Only uploads from the preceding 24 hours are eligible.

YouTube has no per-channel fetch or publish quota. Fresh videos are processed
before the high-volume RSS queue, and a channel remains eligible for the next
30-minute worker run until all of its current candidates are cached. The home
feed inserts one YouTube card after every four article cards; signup and Hub
widgets keep their existing cadence and take priority when two placements would
otherwise occupy the same gap.

Dexerto ingestion uses the dedicated Twitch RSS feed only. The broader Dexerto
gaming feed is intentionally excluded.

- Production can run immediately through YouTube's official Atom uploads feed.
- For complete pagination when a channel publishes more than the Atom feed
  exposes, configure the Supabase Edge Function secret `YOUTUBE_API_KEY`.
- The worker records playlist quota usage and polls each channel according to
  its database-configured interval and freshness window.

## Game Patch archive

`/game-patch` is Talus's permanent patch archive. It currently tracks 24 games
from their official Steam Community announcement feeds, displays the newest
updates in an image-led catalog, and keeps every rewritten historical patch on
a dedicated game page at `/game-patch/:gameId`.

The JWT-protected `fetch-game-patches` Edge Function refreshes recent releases hourly
and advances older-history backfills until each source is complete. Commerce,
community, preview, and roadmap posts are excluded so the archive remains
focused on shipped patches, hotfixes, balance changes, and release notes. Raw
developer text is private source material and is never returned to public
clients. The bounded `rewrite-game-patches` worker creates a teaser and a full
sectioned article in two locked Talus editorial passes, rejects copied source
sentences, and only publishes records that pass structural validation.

Every tile links to `/game-patch/:gameId/:patchId`, where the full article,
practical callouts, takeaway, official-source link, canonical game link, title,
description, and Article structured data are present in the initial server
response. `/patch-sitemap.xml` lists every published permanent patch URL.

## Free Games

`/free-games` tracks active, legitimate game giveaways across Epic Games,
Steam, GOG, itch.io, mobile stores, and other supported platforms. The
`fetch-free-games` Edge Function refreshes GamerPower's broad public game feed
and Epic Games Store's official promotions endpoint every 30 minutes. Talus
merges duplicates in favor of first-party storefront data, supports upcoming
offers, archives expired offers, and keeps the claim destination, original
price, and expiry time attached to the canonical Game record. GamerPower
redirects are resolved during ingestion so public Claim buttons store the final
offer destination rather than an aggregation hop. Every card reads its title,
art, platforms, and introduction through the canonical Game relationship; its
title and Read more action open that same game page. Missing Game descriptions
are gradually filled by the locked Talus editorial workflow. GamerPower
attribution is shown on the page as required by its API terms.

## Canonical game records

Reviews, Free Games, and Game Patch share `public.games` as their single source
of truth. Store offers retain only offer-specific fields and reference a game
by foreign key; patch records use the same relationship. Game rows hold
canonical metadata, external ratings, live Talus rating aggregates, and the
current free-to-claim state. Community review votes are stored per user,
comments are attached to reviews, and genre rankings are calculated from the
canonical aggregates. Missing editorial descriptions are created once through
a locked two-pass Talus voice workflow and remain editable in the game record.

## AI generation

Talus uses Gemini first for news cards, video cards, article processing, and
daily trivia. Groq is the automatic continuity fallback; Kimi is disabled.
All providers receive the same server-side, versioned Talus editorial style
lock from `supabase/functions/_shared/talus-ai.ts`.

Required Supabase Edge Function secrets:

- `GEMINI_API_KEY`
- `GEMINI_MODEL` (production default: `gemini-3.5-flash-lite`)
- `GROQ_API_KEY`
