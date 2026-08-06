"""
Optional stealth news worker — Scrapling edition (QA F10.5).

WHY THIS EXISTS
The main news pipeline is the `fetch-news` Supabase Edge Function (Deno): it
pulls RSS feeds, filters non-gaming items, summarizes with Groq, and upserts
into `cached_articles`. RSS never needs stealth, so that pipeline stays as-is.

Some sites have no RSS feed or block plain HTTP scrapers. Scrapling's stealth
mode (https://github.com/D4Vinci/Scrapling) drives a real hardened Firefox
(Camoufox), which CANNOT run inside Supabase Edge Functions or Vercel
serverless. This worker is the escape hatch: run it anywhere Python + a
browser can live (your PC, a VPS, a GitHub Actions cron) and it feeds the SAME
`cached_articles` table in the SAME shape — the frontend template never knows
the difference.

SETUP
    pip install "scrapling[fetchers]" supabase
    scrapling install          # downloads the stealth browser

    set SUPABASE_URL=https://zxcqqsviwtwxukizibef.supabase.co
    set SUPABASE_SERVICE_KEY=<service_role key — NEVER commit it>

    python tools/scrapling_news_worker.py

Add sources to STEALTH_SOURCES below. Keep it polite: low volume, generous
delays, and respect robots.txt / site ToS — stealth mode is for sites that
block all automation indiscriminately, not for abuse.
"""

from __future__ import annotations

import os
import sys
import time
from datetime import datetime, timedelta, timezone

from scrapling.fetchers import StealthyFetcher
from supabase import create_client

# ── Config ───────────────────────────────────────────────────────────────────

# Each source: a listing page + CSS selectors for article links, title, body.
# These are EXAMPLES — verify selectors before enabling a source.
STEALTH_SOURCES = [
    # {
    #     "name": "ExampleGamingSite",
    #     "list_url": "https://example.com/gaming/news",
    #     "link_selector": "article h2 a",
    #     "title_selector": "h1",
    #     "body_selector": "div.article-body p",
    #     "max_articles": 3,
    # },
]

ARTICLE_DELAY_SECONDS = 8      # be polite between article fetches
SUMMARY_MAX_CHARS = 600        # plain-text fallback summary length


def get_supabase():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        sys.exit("Set SUPABASE_URL and SUPABASE_SERVICE_KEY first.")
    return create_client(url, key)


def already_cached(sb, source_url: str) -> bool:
    res = (
        sb.table("cached_articles")
        .select("source_url")
        .eq("source_url", source_url)
        .limit(1)
        .execute()
    )
    return bool(res.data)


def news_updates_enabled(sb) -> bool:
    """Honor the same operational kill switch as the Edge Functions."""
    res = (
        sb.table("operational_controls")
        .select("enabled")
        .eq("key", "news_updates")
        .limit(1)
        .execute()
    )
    return not res.data or bool(res.data[0].get("enabled", True))


def upsert_article(sb, *, source: str, title: str, url: str, summary: str,
                   image_url: str | None) -> None:
    """Match the exact shape fetch-news writes so the frontend template is
    completely unaffected. game_tags are left empty here — the existing
    process-article / compute-trending machinery reads what it needs and the
    Groq tagging can be layered on later if desired."""
    now = datetime.now(timezone.utc)
    sb.table("cached_articles").upsert(
        {
            "original_id": f"{source}-{url[-60:]}",
            "title": title,
            "summary": summary,
            "source_url": url,
            "image_url": image_url or "",
            "og_image_url": image_url,
            "category": "Gaming",
            "source": source,
            "author": source,
            "ai_title": title,
            "ai_summary": summary,
            "game_tags": [],
            "tags": [],
            "likes": 0,
            "article_date": now.isoformat(),
            "expires_at": (now + timedelta(days=365)).isoformat(),
        },
        on_conflict="source_url",
    ).execute()


def run() -> None:
    if not STEALTH_SOURCES:
        print("No STEALTH_SOURCES configured — add sources (with verified "
              "selectors) at the top of this file.")
        return

    sb = get_supabase()

    if not news_updates_enabled(sb):
        print("News updates are paused by operational control — exiting.")
        return

    for src in STEALTH_SOURCES:
        print(f"[{src['name']}] fetching listing {src['list_url']}")
        listing = StealthyFetcher.fetch(
            src["list_url"], headless=True, network_idle=True,
        )
        if listing.status != 200:
            print(f"[{src['name']}] listing HTTP {listing.status}, skipping")
            continue

        links: list[str] = []
        for a in listing.css(src["link_selector"]):
            href = a.attrib.get("href", "")
            if href.startswith("/"):
                from urllib.parse import urljoin
                href = urljoin(src["list_url"], href)
            if href.startswith("http") and href not in links:
                links.append(href)
            if len(links) >= src.get("max_articles", 3):
                break

        print(f"[{src['name']}] {len(links)} candidate articles")

        for url in links:
            if already_cached(sb, url):
                print(f"  cached, skip: {url}")
                continue

            page = StealthyFetcher.fetch(url, headless=True, network_idle=True)
            if page.status != 200:
                print(f"  HTTP {page.status}: {url}")
                continue

            title_el = page.css_first(src["title_selector"])
            title = title_el.text.strip() if title_el else ""
            paragraphs = [p.text.strip() for p in page.css(src["body_selector"])]
            body = " ".join(p for p in paragraphs if p)
            og = page.css_first('meta[property="og:image"]')
            image = og.attrib.get("content") if og is not None else None

            if not title or len(body) < 200:
                print(f"  thin content, skip: {url}")
                continue

            summary = body[:SUMMARY_MAX_CHARS].rsplit(" ", 1)[0] + "…"
            upsert_article(sb, source=src["name"], title=title, url=url,
                           summary=summary, image_url=image)
            print(f"  saved: {title[:70]}")
            time.sleep(ARTICLE_DELAY_SECONDS)


if __name__ == "__main__":
    run()
