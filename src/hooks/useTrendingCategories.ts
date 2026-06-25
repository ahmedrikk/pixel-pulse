import { useState, useEffect } from "react";
import { getTrendingTags } from "@/lib/newsCache";

export interface TrendingCategory {
  /** Pretty display name, e.g. "Rockstar Games" */
  name: string;
  /** Raw tag slug as stored on articles, e.g. "RockstarGames" — used for filtering */
  slug: string;
  /** Real number of cached articles tagged with this */
  count: number;
  isTrending: boolean;
}

/** Insert spaces at case/digit boundaries so PascalCase tags read naturally. */
export function prettifyTag(tag: string): string {
  return tag
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .trim();
}

/**
 * Real "Browse by category" data — the most-tagged entities across the live
 * article cache, with genuine article counts. Top 3 are flagged as trending.
 */
export function useTrendingCategories(limit = 12): { categories: TrendingCategory[]; isLoading: boolean } {
  const [categories, setCategories] = useState<TrendingCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getTrendingTags(limit)
      .then((tags) => {
        if (cancelled) return;
        setCategories(
          tags.map((t, i) => ({
            name: prettifyTag(t.tag),
            slug: t.tag,
            count: t.count,
            isTrending: i < 3,
          }))
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [limit]);

  return { categories, isLoading };
}
