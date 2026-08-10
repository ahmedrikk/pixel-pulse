import { useQuery } from "@tanstack/react-query";
import { fetchGameList, normalisePlatforms } from "@/lib/rawg";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Gamepad2 } from "lucide-react";
import {
  siCounterstrike,
  siDota2,
  siLeagueoflegends,
  siPubg,
  siValorant,
  type SimpleIcon,
} from "simple-icons";

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
  "king of glory": "Honor of Kings",
};

const BRAND_ICONS: Record<string, SimpleIcon> = {
  "league of legends": siLeagueoflegends,
  lol: siLeagueoflegends,
  cs2: siCounterstrike,
  "counter strike": siCounterstrike,
  "counter strike 2": siCounterstrike,
  "counter-strike 2": siCounterstrike,
  valorant: siValorant,
  "dota 2": siDota2,
  dota2: siDota2,
  pubg: siPubg,
  "pubg battlegrounds": siPubg,
};

const BRAND_IMAGE_URLS: Record<string, string> = {
  "king of glory": "https://cdn.gameboost.com/games/logos/honor-of-kings.png",
  "honor of kings": "https://cdn.gameboost.com/games/logos/honor-of-kings.png",
  "mobile legends bang bang": "https://esports.tunesf.tn/media/13933/1f5c1b161030045642b6353478b12f69.png",
  "mobile legends": "https://esports.tunesf.tn/media/13933/1f5c1b161030045642b6353478b12f69.png",
  "rocket league": "https://cdn.akamai.steamstatic.com/steam/apps/252950/header.jpg",
  "rainbow six siege": "https://cdn.akamai.steamstatic.com/steam/apps/359550/header.jpg",
  "rainbow 6 siege": "https://cdn.akamai.steamstatic.com/steam/apps/359550/header.jpg",
  "tom clancy s rainbow six siege": "https://cdn.akamai.steamstatic.com/steam/apps/359550/header.jpg",
  r6: "https://cdn.akamai.steamstatic.com/steam/apps/359550/header.jpg",
  "overwatch": "https://cdn.akamai.steamstatic.com/steam/apps/2357570/header.jpg",
  "overwatch 2": "https://cdn.akamai.steamstatic.com/steam/apps/2357570/header.jpg",
  "apex legends": "https://cdn.akamai.steamstatic.com/steam/apps/1172470/header.jpg",
  "call of duty": "https://cdn.akamai.steamstatic.com/steam/apps/1938090/header.jpg",
  "starcraft ii": "https://upload.wikimedia.org/wikipedia/en/2/20/StarCraft_II_-_Box_Art.jpg",
  "starcraft 2": "https://upload.wikimedia.org/wikipedia/en/2/20/StarCraft_II_-_Box_Art.jpg",
  "hearthstone": "https://upload.wikimedia.org/wikipedia/en/5/5a/Hearthstone_2016_logo.png",
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

function useGameArtwork(name: string, suppliedUrl?: string | null, hasBundledIcon = false) {
  return useQuery({
    queryKey: ["game-artwork", normalizeName(name)],
    queryFn: () => findGameArtwork(name),
    enabled: !suppliedUrl && !hasBundledIcon && name.trim().length > 1,
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
  const normalized = normalizeName(name);
  const brandIcon = BRAND_ICONS[normalized];
  const brandImage = BRAND_IMAGE_URLS[normalized];
  const artwork = useGameArtwork(name, src, Boolean(brandIcon || brandImage));

  if (!src && brandIcon) {
    return (
      <span
        role="img"
        aria-label={`${name} logo`}
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-white p-1.5",
          className,
        )}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-full w-full" fill={`#${brandIcon.hex}`}>
          <path d={brandIcon.path} />
        </svg>
      </span>
    );
  }

  if (!src && brandImage) {
    return (
      <span className={cn("relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-secondary", className)}>
        <Gamepad2 className="h-1/2 w-1/2 text-muted-foreground" aria-hidden="true" />
        <img
          src={brandImage}
          alt={`${name} logo`}
          loading="lazy"
          onError={(event) => { event.currentTarget.style.display = "none"; }}
          className="absolute inset-0 h-full w-full bg-white object-cover"
        />
      </span>
    );
  }

  if (artwork) {
    return (
      <span className={cn("relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-secondary", className)}>
        <Gamepad2 className="h-1/2 w-1/2 text-muted-foreground" aria-hidden="true" />
        <img
          src={artwork}
          alt={`${name} artwork`}
          loading="lazy"
          onError={(event) => { event.currentTarget.style.display = "none"; }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </span>
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
      <Gamepad2 className="h-1/2 w-1/2" aria-hidden="true" />
    </span>
  );
}
