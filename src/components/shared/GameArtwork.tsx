import { useQuery } from "@tanstack/react-query";
import { fetchGameList, normalisePlatforms } from "@/lib/rawg";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const ARTWORK_SEARCH_ALIASES: Record<string, string> = {
  cs2: "Counter-Strike 2",
  "counter strike": "Counter-Strike 2",
  lol: "League of Legends",
  dota2: "Dota 2",
  "rainbow six siege": "Tom Clancy's Rainbow Six Siege",
  r6: "Tom Clancy's Rainbow Six Siege",
  pubg: "PUBG: Battlegrounds",
};

function searchName(name: string) {
  return ARTWORK_SEARCH_ALIASES[normalizeName(name)] ?? name;
}

async function findGameArtwork(name: string): Promise<string | null> {
  const lookup = searchName(name);
  const normalized = normalizeName(lookup);
  const words = normalized.split(" ").filter((word) => word.length > 2);
  const searchTerm = words.slice(0, 2).join(" ") || normalized;

  const { data: stored } = await supabase
    .from("games")
    .select("id, name, cover_image")
    .ilike("name", `%${searchTerm.replace(/[%_]/g, "")}%`)
    .not("cover_image", "is", null)
    .limit(10);
  const storedExact = (stored ?? []).find((game) => normalizeName(game.name) === normalized);
  const storedMatch = storedExact ?? stored?.[0];
  if (storedMatch?.cover_image) return storedMatch.cover_image;

  try {
    const response = await fetchGameList({ search: lookup, page_size: 5 });
    const candidates = response.results ?? [];
    const exact = candidates.find((game) => normalizeName(game.name) === normalized);
    const resolved = exact ?? candidates.find((game) => game.background_image);
    if (!resolved?.background_image) return null;

    await supabase.from("games").upsert({
      id: resolved.slug,
      slug: resolved.slug,
      name: resolved.name,
      cover_image: resolved.background_image,
      genres: resolved.genres?.map((genre) => genre.slug) ?? [],
      platforms: normalisePlatforms(resolved.platforms),
      release_date: resolved.released ?? "TBA",
      rawg_rating: resolved.rating,
      metacritic_score: resolved.metacritic,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });

    return resolved.background_image;
  } catch {
    return null;
  }
}

function useGameArtwork(name: string, suppliedUrl?: string | null) {
  return useQuery({
    queryKey: ["game-artwork", normalizeName(name)],
    queryFn: () => findGameArtwork(name),
    enabled: !suppliedUrl && name.trim().length > 1,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    retry: 1,
  }).data ?? suppliedUrl ?? null;
}

interface GameArtworkProps {
  name: string;
  src?: string | null;
  className?: string;
  fallbackClassName?: string;
}

export function GameArtwork({ name, src, className, fallbackClassName }: GameArtworkProps) {
  const artwork = useGameArtwork(name, src);

  if (artwork) {
    return (
      <img
        src={artwork}
        alt={`${name} artwork`}
        loading="lazy"
        className={cn("h-10 w-10 shrink-0 rounded-lg border border-border/60 object-cover", className)}
      />
    );
  }

  return (
    <span
      aria-label={name}
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-gradient-to-br from-primary/15 to-accent/20 text-xs font-black text-primary",
        className,
        fallbackClassName,
      )}
    >
      {name.trim().slice(0, 2).toUpperCase() || "G"}
    </span>
  );
}
