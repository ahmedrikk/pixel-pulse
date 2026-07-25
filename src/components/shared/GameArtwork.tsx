import { useQuery } from "@tanstack/react-query";
import { fetchGameList } from "@/lib/rawg";
import { cn } from "@/lib/utils";

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function findGameArtwork(name: string): Promise<string | null> {
  const response = await fetchGameList({ search: name, page_size: 5 });
  const normalized = normalizeName(name);
  const candidates = response.results ?? [];
  const exact = candidates.find((game) => normalizeName(game.name) === normalized);
  return exact?.background_image ?? candidates.find((game) => game.background_image)?.background_image ?? null;
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
